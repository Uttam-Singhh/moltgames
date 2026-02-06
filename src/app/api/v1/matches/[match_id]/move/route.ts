import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { SubmitMoveSchema } from "@/types";
import { db } from "@/db";
import { matches, rounds, players } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveRound, checkMatchEnd } from "@/lib/game-logic";
import { calculateEloChange } from "@/lib/elo";
import { sendPayout } from "@/lib/x402";
import { ENTRY_FEE_USDC } from "@/lib/constants";
import { checkAndResolveTimeout } from "@/lib/timeout";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    const { match_id } = await params;

    const body = await request.json();
    const parsed = SubmitMoveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid move", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { move, reasoning } = parsed.data;

    // Get match
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, match_id))
      .limit(1);

    if (!match) {
      throw new ApiError(404, "Match not found");
    }

    if (match.status !== "in_progress") {
      throw new ApiError(400, "Match is not in progress");
    }

    const isPlayer1 = user.id === match.player1Id;
    const isPlayer2 = user.id === match.player2Id;

    if (!isPlayer1 && !isPlayer2) {
      throw new ApiError(403, "You are not a participant in this match");
    }

    // Get current round
    const [currentRound] = await db
      .select()
      .from(rounds)
      .where(
        and(
          eq(rounds.matchId, match_id),
          eq(rounds.roundNumber, match.currentRound)
        )
      )
      .limit(1);

    if (!currentRound) {
      throw new ApiError(500, "Current round not found");
    }

    // Check if already submitted
    if (isPlayer1 && currentRound.player1Move) {
      throw new ApiError(400, "You already submitted a move this round");
    }
    if (isPlayer2 && currentRound.player2Move) {
      throw new ApiError(400, "You already submitted a move this round");
    }

    // Check round timeout — resolve forfeit if timed out
    const roundAge =
      Date.now() - currentRound.createdAt.getTime();
    if (roundAge > 30_000) {
      const timeoutResult = await checkAndResolveTimeout(match_id);
      if (timeoutResult?.forfeited) {
        return NextResponse.json({
          status: "match_forfeited",
          winner_id: timeoutResult.winnerId,
          loser_id: timeoutResult.loserId,
          payout_tx: timeoutResult.payoutTx,
          reason: "Round timed out",
        });
      }
      throw new ApiError(400, "Round has timed out", "ROUND_TIMEOUT");
    }

    // Submit move
    const updateData: Record<string, unknown> = {};
    if (isPlayer1) {
      updateData.player1Move = move;
      updateData.player1Reasoning = reasoning ?? null;
    } else {
      updateData.player2Move = move;
      updateData.player2Reasoning = reasoning ?? null;
    }

    await db
      .update(rounds)
      .set(updateData)
      .where(eq(rounds.id, currentRound.id));

    // Re-fetch round to check if both moves are in
    const [updatedRound] = await db
      .select()
      .from(rounds)
      .where(eq(rounds.id, currentRound.id))
      .limit(1);

    if (updatedRound.player1Move && updatedRound.player2Move) {
      // Resolve the round
      const result = resolveRound(
        updatedRound.player1Move,
        updatedRound.player2Move
      );

      let winnerId: string | null = null;
      let newP1Score = match.player1Score;
      let newP2Score = match.player2Score;

      if (result === "player1") {
        winnerId = match.player1Id;
        newP1Score++;
      } else if (result === "player2") {
        winnerId = match.player2Id;
        newP2Score++;
      }
      // tie: no score change

      // Update round
      await db
        .update(rounds)
        .set({
          winnerId,
          resolvedAt: new Date(),
        })
        .where(eq(rounds.id, currentRound.id));

      // Check if match is over
      const matchEnd = checkMatchEnd(
        newP1Score,
        newP2Score,
        match.currentRound
      );

      if (matchEnd.ended) {
        // Determine winner
        const matchWinnerId =
          newP1Score > newP2Score
            ? match.player1Id
            : match.player2Id;
        const matchLoserId =
          matchWinnerId === match.player1Id
            ? match.player2Id
            : match.player1Id;

        // Get players for ELO
        const [winner] = await db
          .select()
          .from(players)
          .where(eq(players.id, matchWinnerId))
          .limit(1);
        const [loser] = await db
          .select()
          .from(players)
          .where(eq(players.id, matchLoserId))
          .limit(1);

        const { winnerChange, loserChange } = calculateEloChange(
          winner.eloRating,
          loser.eloRating
        );

        // Send payout to winner
        const payoutAmount = String(parseFloat(ENTRY_FEE_USDC) * 2);
        let payoutTx: string | null = null;
        if (winner.walletAddress) {
          payoutTx = await sendPayout(
            winner.walletAddress,
            payoutAmount
          );
        }

        // Update match
        await db
          .update(matches)
          .set({
            player1Score: newP1Score,
            player2Score: newP2Score,
            winnerId: matchWinnerId,
            status: "completed",
            completedAt: new Date(),
            player1EloChange:
              matchWinnerId === match.player1Id
                ? winnerChange
                : loserChange,
            player2EloChange:
              matchWinnerId === match.player2Id
                ? winnerChange
                : loserChange,
            payoutTx,
          })
          .where(eq(matches.id, match_id));

        // Update player stats
        await db
          .update(players)
          .set({
            eloRating: winner.eloRating + winnerChange,
            wins: winner.wins + 1,
            totalMatches: winner.totalMatches + 1,
            totalEarnings: String(
              parseFloat(winner.totalEarnings) +
                parseFloat(payoutAmount)
            ),
            updatedAt: new Date(),
          })
          .where(eq(players.id, matchWinnerId));

        await db
          .update(players)
          .set({
            eloRating: loser.eloRating + loserChange,
            losses: loser.losses + 1,
            totalMatches: loser.totalMatches + 1,
            updatedAt: new Date(),
          })
          .where(eq(players.id, matchLoserId));

        return NextResponse.json({
          status: "match_complete",
          round_result: result,
          round_number: match.currentRound,
          player1_score: newP1Score,
          player2_score: newP2Score,
          winner_id: matchWinnerId,
          payout_tx: payoutTx,
        });
      }

      // Match continues — create next round
      const nextRound = match.currentRound + 1;
      await db.insert(rounds).values({
        matchId: match_id,
        roundNumber: nextRound,
      });

      await db
        .update(matches)
        .set({
          player1Score: newP1Score,
          player2Score: newP2Score,
          currentRound: nextRound,
        })
        .where(eq(matches.id, match_id));

      return NextResponse.json({
        status: "round_resolved",
        round_result: result,
        round_number: match.currentRound,
        player1_score: newP1Score,
        player2_score: newP2Score,
        next_round: nextRound,
      });
    }

    // Only one move submitted so far
    return NextResponse.json({
      status: "move_submitted",
      round_number: match.currentRound,
      message: "Waiting for opponent's move...",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
