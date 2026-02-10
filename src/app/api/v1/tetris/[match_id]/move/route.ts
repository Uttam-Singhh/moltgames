import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { SubmitTetrisMoveSchema } from "@/types";
import { db } from "@/db";
import { matches, tetrisGames, tetrisMoves, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getPieceAtIndex,
  isValidPlacement,
  applyMove,
  boardToGrid,
  getCurrentAndNextPiece,
  calculateGravityInterval,
} from "@/lib/tetris-game-logic";
import { processGravityDrops } from "@/lib/tetris-gravity";
import { calculateEloChange } from "@/lib/elo";
import { sendPayout } from "@/lib/x402";
import { ENTRY_FEE_USDC } from "@/lib/constants";
import type { TetrisPiece } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    const { match_id } = await params;

    const body = await request.json();
    const parsed = SubmitTetrisMoveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid move",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { rotation, column, reasoning } = parsed.data;

    // Process gravity drops for BOTH players first
    const gravityResult = await processGravityDrops(match_id);

    if (gravityResult.gameEnded) {
      return NextResponse.json({
        status: "match_complete",
        winner_id: gravityResult.winnerId ?? null,
        loser_id: gravityResult.loserId ?? null,
        payout_tx: gravityResult.payoutTx ?? null,
        reason: "Game ended during gravity processing",
      });
    }

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

    // Get player-specific state
    const playerBoard = isPlayer1 ? game.player1Board : game.player2Board;
    const playerScore = isPlayer1 ? game.player1Score : game.player2Score;
    const playerLines = isPlayer1 ? game.player1Lines : game.player2Lines;
    const playerLevel = isPlayer1 ? game.player1Level : game.player2Level;
    const playerPieceIndex = isPlayer1
      ? game.player1PieceIndex
      : game.player2PieceIndex;
    const playerPendingGarbage = isPlayer1
      ? game.player1PendingGarbage
      : game.player2PendingGarbage;
    const playerAlive = isPlayer1 ? game.player1Alive : game.player2Alive;

    if (!playerAlive) {
      throw new ApiError(400, "You are already eliminated");
    }

    // Get current piece
    const piece = getPieceAtIndex(
      game.seed,
      playerPieceIndex
    ) as TetrisPiece;

    // Validate placement
    if (!isValidPlacement(playerBoard, piece, rotation, column)) {
      throw new ApiError(
        400,
        `Invalid placement: piece ${piece} rotation ${rotation} column ${column} does not fit`,
        "INVALID_PLACEMENT"
      );
    }

    // Apply move
    const result = applyMove(
      playerBoard,
      piece,
      rotation,
      column,
      playerPendingGarbage,
      playerScore,
      playerLines,
      playerLevel,
      game.seed,
      playerPieceIndex
    );

    // Get next move number
    const existingMoves = await db
      .select({ moveNumber: tetrisMoves.moveNumber })
      .from(tetrisMoves)
      .where(eq(tetrisMoves.matchId, match_id))
      .orderBy(tetrisMoves.moveNumber);

    const nextMoveNumber =
      existingMoves.length > 0
        ? existingMoves[existingMoves.length - 1].moveNumber + 1
        : 1;

    // Record move
    await db.insert(tetrisMoves).values({
      matchId: match_id,
      playerId: user.id,
      piece,
      rotation,
      column,
      linesCleared: result.linesCleared,
      garbageSent: result.garbageSent,
      garbageReceived: result.garbageReceived,
      scoreAfter: result.newScore,
      levelAfter: result.newLevel,
      boardAfter: result.newBoard,
      moveNumber: nextMoveNumber,
      isAutoDrop: false,
      reasoning: reasoning ?? null,
    });

    // Update player state
    const playerUpdate = isPlayer1
      ? {
          player1Board: result.newBoard,
          player1Score: result.newScore,
          player1Lines: result.newLines,
          player1Level: result.newLevel,
          player1PieceIndex: playerPieceIndex + 1,
          player1PendingGarbage: 0,
          player1Alive: result.alive,
          player1LastMoveAt: new Date(),
        }
      : {
          player2Board: result.newBoard,
          player2Score: result.newScore,
          player2Lines: result.newLines,
          player2Level: result.newLevel,
          player2PieceIndex: playerPieceIndex + 1,
          player2PendingGarbage: 0,
          player2Alive: result.alive,
          player2LastMoveAt: new Date(),
        };

    await db
      .update(tetrisGames)
      .set(playerUpdate)
      .where(eq(tetrisGames.matchId, match_id));

    // Add garbage to opponent
    if (result.garbageSent > 0) {
      const opponentGarbageField = isPlayer1
        ? "player2PendingGarbage"
        : "player1PendingGarbage";
      const currentOpponentGarbage = isPlayer1
        ? game.player2PendingGarbage
        : game.player1PendingGarbage;

      await db
        .update(tetrisGames)
        .set({
          [opponentGarbageField]: currentOpponentGarbage + result.garbageSent,
        })
        .where(eq(tetrisGames.matchId, match_id));
    }

    // Check if player died
    if (!result.alive) {
      const opponentAlive = isPlayer1
        ? game.player2Alive
        : game.player1Alive;

      if (opponentAlive) {
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

        if (winner && loser) {
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
              status: "completed",
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
            status: "match_complete",
            board: result.newBoard,
            board_grid: boardToGrid(result.newBoard),
            winner_id: winnerId,
            payout_tx: payoutTx,
            move_number: nextMoveNumber,
            lines_cleared: result.linesCleared,
            garbage_sent: result.garbageSent,
            score: result.newScore,
            level: result.newLevel,
          });
        }
      }
    }

    // Game continues — return new state
    const newPieces = getCurrentAndNextPiece(
      game.seed,
      playerPieceIndex + 1
    );

    return NextResponse.json({
      status: "move_accepted",
      board: result.newBoard,
      board_grid: boardToGrid(result.newBoard),
      current_piece: newPieces.current,
      next_piece: newPieces.next,
      move_number: nextMoveNumber,
      lines_cleared: result.linesCleared,
      garbage_sent: result.garbageSent,
      garbage_received: result.garbageReceived,
      score: result.newScore,
      lines: result.newLines,
      level: result.newLevel,
      alive: result.alive,
      gravity_interval: calculateGravityInterval(result.newLevel),
      message: "Piece placed successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
