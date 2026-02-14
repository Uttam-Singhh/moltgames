import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, tttGames, tttMoves, players } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { boardToGrid, isTttSuddenDeath } from "@/lib/ttt-game-logic";
import { checkAndResolveTttTimeout } from "@/lib/ttt-timeout";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const isViewer = authHeader === "Bearer viewer";

    let user: { id: string; username: string } | null = null;
    if (!isViewer) {
      user = await authenticateRequest(request);
    }

    const { match_id } = await params;

    // Check for timeout before returning state
    await checkAndResolveTttTimeout(match_id);

    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, match_id))
      .limit(1);

    if (!match) {
      throw new ApiError(404, "Match not found");
    }

    if (match.gameType !== "ttt") {
      throw new ApiError(400, "This is not a TTT match");
    }

    // Get player info
    const [p1] = await db
      .select({
        id: players.id,
        username: players.username,
        avatarUrl: players.avatarUrl,
        eloRating: players.eloRating,
      })
      .from(players)
      .where(eq(players.id, match.player1Id))
      .limit(1);

    const [p2] = await db
      .select({
        id: players.id,
        username: players.username,
        avatarUrl: players.avatarUrl,
        eloRating: players.eloRating,
      })
      .from(players)
      .where(eq(players.id, match.player2Id))
      .limit(1);

    // Get ALL TTT game rows for this match (ordered by roundNumber)
    const allGames = await db
      .select()
      .from(tttGames)
      .where(eq(tttGames.matchId, match_id))
      .orderBy(asc(tttGames.roundNumber));

    // Get ALL moves grouped by round
    const allMoves = await db
      .select()
      .from(tttMoves)
      .where(eq(tttMoves.matchId, match_id))
      .orderBy(asc(tttMoves.roundNumber), asc(tttMoves.moveNumber));

    // Current round game
    const currentGame = allGames.find(
      (g) => g.roundNumber === match.currentRound
    );

    // Build rounds array
    const rounds = allGames.map((g) => {
      const roundMoves = allMoves
        .filter((m) => m.roundNumber === g.roundNumber)
        .map((m) => ({
          position: m.position,
          symbol: m.symbol,
          move_number: m.moveNumber,
          player_id: m.playerId,
          reasoning: m.reasoning,
          created_at: m.createdAt.toISOString(),
        }));

      return {
        round_number: g.roundNumber,
        board: g.board,
        board_grid: boardToGrid(g.board),
        move_count: g.moveCount,
        current_turn: g.currentTurn,
        winner_id: g.winnerId,
        is_draw: g.isDraw,
        moves: roundMoves,
      };
    });

    // Flat moves for current round (backward compat)
    const currentRoundMoves = allMoves
      .filter((m) => m.roundNumber === match.currentRound)
      .map((m) => ({
        position: m.position,
        symbol: m.symbol,
        move_number: m.moveNumber,
        player_id: m.playerId,
        reasoning: m.reasoning,
        created_at: m.createdAt.toISOString(),
      }));

    const suddenDeath = isTttSuddenDeath(
      match.player1Score,
      match.player2Score,
      match.currentRound
    );

    return NextResponse.json({
      id: match.id,
      game_type: "ttt",
      player1: {
        id: p1.id,
        username: p1.username,
        avatar_url: p1.avatarUrl,
        elo_rating: p1.eloRating,
        symbol: "X",
      },
      player2: {
        id: p2.id,
        username: p2.username,
        avatar_url: p2.avatarUrl,
        elo_rating: p2.eloRating,
        symbol: "O",
      },
      status: match.status,
      winner_id: match.winnerId,
      // Current round fields (backward compat)
      board: currentGame?.board ?? "---------",
      board_grid: boardToGrid(currentGame?.board ?? "---------"),
      current_turn: currentGame?.currentTurn ?? null,
      move_count: currentGame?.moveCount ?? 0,
      last_move_at: currentGame?.lastMoveAt?.toISOString() ?? null,
      moves: currentRoundMoves,
      // Multi-round fields
      player1_score: match.player1Score,
      player2_score: match.player2Score,
      current_round: match.currentRound,
      sudden_death: suddenDeath,
      rounds,
      // Match metadata
      entry_fee: match.entryFee,
      payout_tx: match.payoutTx,
      player1_elo_change: match.player1EloChange,
      player2_elo_change: match.player2EloChange,
      created_at: match.createdAt.toISOString(),
      completed_at: match.completedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
