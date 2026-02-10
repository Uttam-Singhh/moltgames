import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, tetrisGames, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateEloChange } from "@/lib/elo";
import { sendPayout } from "@/lib/x402";
import { ENTRY_FEE_USDC } from "@/lib/constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    const { match_id } = await params;

    // Get match
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, match_id))
      .limit(1);

    if (!match) {
      throw new ApiError(404, "Match not found");
    }

    if (match.gameType !== "tetris") {
      throw new ApiError(400, "This is not a Tetris match");
    }

    if (match.status !== "in_progress") {
      throw new ApiError(400, "Match is not in progress");
    }

    const isPlayer1 = user.id === match.player1Id;
    const isPlayer2 = user.id === match.player2Id;

    if (!isPlayer1 && !isPlayer2) {
      throw new ApiError(403, "You are not a participant in this match");
    }

    // Get game state
    const [game] = await db
      .select()
      .from(tetrisGames)
      .where(eq(tetrisGames.matchId, match_id))
      .limit(1);

    if (!game) {
      throw new ApiError(500, "Game state not found");
    }

    const playerAlive = isPlayer1 ? game.player1Alive : game.player2Alive;
    if (!playerAlive) {
      throw new ApiError(400, "You are already eliminated");
    }

    // Mark forfeiting player as dead
    if (isPlayer1) {
      await db
        .update(tetrisGames)
        .set({ player1Alive: false })
        .where(eq(tetrisGames.matchId, match_id));
    } else {
      await db
        .update(tetrisGames)
        .set({ player2Alive: false })
        .where(eq(tetrisGames.matchId, match_id));
    }

    // Opponent wins
    const winnerId = isPlayer1 ? match.player2Id : match.player1Id;
    const loserId = user.id;

    const [winner] = await db
      .select()
      .from(players)
      .where(eq(players.id, winnerId))
      .limit(1);
    const [loser] = await db
      .select()
      .from(players)
      .where(eq(players.id, loserId))
      .limit(1);

    if (!winner || !loser) {
      throw new ApiError(500, "Player data not found");
    }

    const { winnerChange, loserChange } = calculateEloChange(
      winner.eloRating,
      loser.eloRating
    );

    const payoutAmount = String(parseFloat(ENTRY_FEE_USDC) * 2);
    let payoutTx: string | null = null;
    if (winner.walletAddress) {
      payoutTx = await sendPayout(winner.walletAddress, payoutAmount);
    }

    await db
      .update(matches)
      .set({
        winnerId,
        status: "forfeited",
        completedAt: new Date(),
        player1EloChange:
          winnerId === match.player1Id ? winnerChange : loserChange,
        player2EloChange:
          winnerId === match.player2Id ? winnerChange : loserChange,
        payoutTx,
      })
      .where(eq(matches.id, match_id));

    await db
      .update(players)
      .set({
        eloRating: winner.eloRating + winnerChange,
        wins: winner.wins + 1,
        totalMatches: winner.totalMatches + 1,
        totalEarnings: String(
          parseFloat(winner.totalEarnings) + parseFloat(payoutAmount)
        ),
        updatedAt: new Date(),
      })
      .where(eq(players.id, winnerId));

    await db
      .update(players)
      .set({
        eloRating: loser.eloRating + loserChange,
        losses: loser.losses + 1,
        totalMatches: loser.totalMatches + 1,
        updatedAt: new Date(),
      })
      .where(eq(players.id, loserId));

    return NextResponse.json({
      status: "match_forfeited",
      winner_id: winnerId,
      loser_id: loserId,
      payout_tx: payoutTx,
      reason: "Player forfeited",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
