import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, tetrisGames, tetrisMoves, players } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  boardToGrid,
  getCurrentAndNextPiece,
  calculateGravityInterval,
} from "@/lib/tetris-game-logic";
import { processGravityDrops } from "@/lib/tetris-gravity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    const isViewer = authHeader === "Bearer viewer";

    if (!isViewer) {
      await authenticateRequest(request);
    }

    const { match_id } = await params;

    // Process gravity drops before returning state
    await processGravityDrops(match_id);

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

    // Get Tetris game state
    const [game] = await db
      .select()
      .from(tetrisGames)
      .where(eq(tetrisGames.matchId, match_id))
      .limit(1);

    if (!game) {
      throw new ApiError(500, "Game state not found");
    }

    // Get all moves
    const moves = await db
      .select()
      .from(tetrisMoves)
      .where(eq(tetrisMoves.matchId, match_id))
      .orderBy(asc(tetrisMoves.createdAt));

    const formattedMoves = moves.map((m) => ({
      piece: m.piece,
      rotation: m.rotation,
      column: m.column,
      lines_cleared: m.linesCleared,
      garbage_sent: m.garbageSent,
      garbage_received: m.garbageReceived,
      score_after: m.scoreAfter,
      level_after: m.levelAfter,
      board_after: m.boardAfter,
      move_number: m.moveNumber,
      is_auto_drop: m.isAutoDrop,
      player_id: m.playerId,
      reasoning: m.reasoning,
      created_at: m.createdAt.toISOString(),
    }));

    // Derive pieces from seed + pieceIndex
    const p1Pieces = getCurrentAndNextPiece(game.seed, game.player1PieceIndex);
    const p2Pieces = getCurrentAndNextPiece(game.seed, game.player2PieceIndex);

    return NextResponse.json({
      id: match.id,
      game_type: "tetris",
      player1: {
        id: p1.id,
        username: p1.username,
        avatar_url: p1.avatarUrl,
        elo_rating: p1.eloRating,
      },
      player2: {
        id: p2.id,
        username: p2.username,
        avatar_url: p2.avatarUrl,
        elo_rating: p2.eloRating,
      },
      status: match.status,
      winner_id: match.winnerId,
      player1_state: {
        board: game.player1Board,
        board_grid: boardToGrid(game.player1Board),
        score: game.player1Score,
        lines: game.player1Lines,
        level: game.player1Level,
        piece_index: game.player1PieceIndex,
        pending_garbage: game.player1PendingGarbage,
        alive: game.player1Alive,
        last_move_at: game.player1LastMoveAt.toISOString(),
        current_piece: p1Pieces.current,
        next_piece: p1Pieces.next,
        gravity_interval: calculateGravityInterval(game.player1Level),
      },
      player2_state: {
        board: game.player2Board,
        board_grid: boardToGrid(game.player2Board),
        score: game.player2Score,
        lines: game.player2Lines,
        level: game.player2Level,
        piece_index: game.player2PieceIndex,
        pending_garbage: game.player2PendingGarbage,
        alive: game.player2Alive,
        last_move_at: game.player2LastMoveAt.toISOString(),
        current_piece: p2Pieces.current,
        next_piece: p2Pieces.next,
        gravity_interval: calculateGravityInterval(game.player2Level),
      },
      moves: formattedMoves,
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
