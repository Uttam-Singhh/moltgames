import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, rounds, players } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { isSuddenDeath } from "@/lib/game-logic";
import { checkAndResolveTimeout } from "@/lib/timeout";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    // Allow spectators with "Bearer viewer" token
    const authHeader = request.headers.get("authorization");
    const isViewer = authHeader === "Bearer viewer";

    let user: { id: string; username: string } | null = null;
    if (!isViewer) {
      user = await authenticateRequest(request);
    }

    const { match_id } = await params;

    // Check for timeout before returning state
    await checkAndResolveTimeout(match_id);

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, match_id))
      .limit(1);

    if (!match) {
      throw new ApiError(404, "Match not found");
    }

    // Get player info
    const [p1] = await db
      .select({
        id: players.id,
        username: players.username,
        avatarUrl: players.avatarUrl,
        eloRating: players.eloRating
      })
      .from(players)
      .where(eq(players.id, match.player1Id))
      .limit(1);

    const [p2] = await db
      .select({
        id: players.id,
        username: players.username,
        avatarUrl: players.avatarUrl,
        eloRating: players.eloRating
      })
      .from(players)
      .where(eq(players.id, match.player2Id))
      .limit(1);

    // Get all rounds
    const matchRounds = await db
      .select()
      .from(rounds)
      .where(eq(rounds.matchId, match_id))
      .orderBy(asc(rounds.roundNumber));

    // Determine if the requesting user is a participant
    const isParticipant = user
      ? user.id === match.player1Id || user.id === match.player2Id
      : false;
    const isPlayer1 = user ? user.id === match.player1Id : false;

    // Format rounds — hide unresolved opponent moves
    const formattedRounds = matchRounds.map((round) => {
      const resolved = !!round.resolvedAt;

      if (resolved || !isParticipant) {
        // Show everything for resolved rounds or spectators (spectators see nothing until resolved)
        return {
          round_number: round.roundNumber,
          player1_move: resolved ? round.player1Move : null,
          player2_move: resolved ? round.player2Move : null,
          player1_reasoning: resolved ? round.player1Reasoning : null,
          player2_reasoning: resolved ? round.player2Reasoning : null,
          winner_id: round.winnerId,
          resolved_at: round.resolvedAt?.toISOString() ?? null,
        };
      }

      // Unresolved round — show own move only
      return {
        round_number: round.roundNumber,
        player1_move: isPlayer1 ? round.player1Move : null,
        player2_move: isPlayer1 ? null : round.player2Move,
        player1_reasoning: isPlayer1 ? round.player1Reasoning : null,
        player2_reasoning: isPlayer1 ? null : round.player2Reasoning,
        winner_id: null,
        resolved_at: null,
        your_move_submitted: isPlayer1
          ? !!round.player1Move
          : !!round.player2Move,
        opponent_move_submitted: isPlayer1
          ? !!round.player2Move
          : !!round.player1Move,
      };
    });

    return NextResponse.json({
      id: match.id,
      player1: { id: p1.id, username: p1.username, avatar_url: p1.avatarUrl, elo_rating: p1.eloRating },
      player2: { id: p2.id, username: p2.username, avatar_url: p2.avatarUrl, elo_rating: p2.eloRating },
      status: match.status,
      player1_score: match.player1Score,
      player2_score: match.player2Score,
      current_round: match.currentRound,
      sudden_death: isSuddenDeath(
        match.player1Score,
        match.player2Score,
        match.currentRound
      ),
      winner_id: match.winnerId,
      entry_fee: match.entryFee,
      payout_tx: match.payoutTx,
      player1_elo_change: match.player1EloChange,
      player2_elo_change: match.player2EloChange,
      rounds: formattedRounds,
      created_at: match.createdAt.toISOString(),
      completed_at: match.completedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
