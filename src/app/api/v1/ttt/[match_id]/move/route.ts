import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { SubmitTttMoveSchema } from "@/types";
import { db } from "@/db";
import { matches, tttGames, tttMoves, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  isValidMove,
  applyMove,
  checkTttGameEnd,
  boardToGrid,
} from "@/lib/ttt-game-logic";
import { calculateEloChange, calculateEloChangeDraw } from "@/lib/elo";
import { sendPayout, sendRefund } from "@/lib/x402";
import { ENTRY_FEE_USDC, TTT_CONSTANTS } from "@/lib/constants";
import { checkAndResolveTttTimeout } from "@/lib/ttt-timeout";
import type { TttSymbol } from "@/lib/ttt-game-logic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ match_id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    const { match_id } = await params;

    const body = await request.json();
    const parsed = SubmitTttMoveSchema.safeParse(body);

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

    const { position, reasoning } = parsed.data;

    // Get match
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
      .from(tttGames)
      .where(eq(tttGames.matchId, match_id))
      .limit(1);

    if (!game) {
      throw new ApiError(500, "Game state not found");
    }

    // Check if it's the player's turn
    if (game.currentTurn !== user.id) {
      throw new ApiError(400, "It's not your turn");
    }

    // Check turn timeout
    const turnAge = Date.now() - game.lastMoveAt.getTime();
    if (turnAge > TTT_CONSTANTS.TURN_TIMEOUT_SECONDS * 1000) {
      const timeoutResult = await checkAndResolveTttTimeout(match_id);
      if (timeoutResult?.forfeited) {
        return NextResponse.json({
          status: "match_forfeited",
          winner_id: timeoutResult.winnerId,
          loser_id: timeoutResult.loserId,
          payout_tx: timeoutResult.payoutTx,
          reason: "Turn timed out",
        });
      }
      throw new ApiError(400, "Turn has timed out", "TURN_TIMEOUT");
    }

    // Validate move
    if (!isValidMove(game.board, position)) {
      throw new ApiError(400, "Invalid move: position is already occupied or out of range");
    }

    // Determine symbol: player1 = X, player2 = O
    const symbol: TttSymbol = isPlayer1 ? "X" : "O";
    const newBoard = applyMove(game.board, position, symbol);
    const newMoveCount = game.moveCount + 1;
    const opponentId = isPlayer1 ? match.player2Id : match.player1Id;

    // Record the move
    await db.insert(tttMoves).values({
      matchId: match_id,
      playerId: user.id,
      position,
      symbol,
      moveNumber: newMoveCount,
      reasoning: reasoning ?? null,
    });

    // Check if game ended
    const gameEnd = checkTttGameEnd(newBoard);

    if (gameEnd.ended && gameEnd.winner) {
      // We have a winner
      const matchWinnerId = user.id;
      const matchLoserId = opponentId;

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

      const payoutAmount = String(parseFloat(ENTRY_FEE_USDC) * 2);
      let payoutTx: string | null = null;
      if (winner.walletAddress) {
        payoutTx = await sendPayout(winner.walletAddress, payoutAmount);
      }

      // Update game state
      await db
        .update(tttGames)
        .set({
          board: newBoard,
          moveCount: newMoveCount,
          lastMoveAt: new Date(),
        })
        .where(eq(tttGames.matchId, match_id));

      // Update match
      await db
        .update(matches)
        .set({
          winnerId: matchWinnerId,
          status: "completed",
          completedAt: new Date(),
          player1EloChange:
            matchWinnerId === match.player1Id ? winnerChange : loserChange,
          player2EloChange:
            matchWinnerId === match.player2Id ? winnerChange : loserChange,
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
            parseFloat(winner.totalEarnings) + parseFloat(payoutAmount)
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
        board: newBoard,
        board_grid: boardToGrid(newBoard),
        winner_id: matchWinnerId,
        winning_symbol: symbol,
        payout_tx: payoutTx,
        move_number: newMoveCount,
      });
    }

    if (gameEnd.ended && gameEnd.isDraw) {
      // Draw - refund both players
      const [p1] = await db
        .select()
        .from(players)
        .where(eq(players.id, match.player1Id))
        .limit(1);
      const [p2] = await db
        .select()
        .from(players)
        .where(eq(players.id, match.player2Id))
        .limit(1);

      const { p1Change, p2Change } = calculateEloChangeDraw(
        p1.eloRating,
        p2.eloRating
      );

      // Refund both players
      let refundTx1: string | null = null;
      let refundTx2: string | null = null;
      if (p1.walletAddress) {
        refundTx1 = await sendRefund(p1.walletAddress);
      }
      if (p2.walletAddress) {
        refundTx2 = await sendRefund(p2.walletAddress);
      }

      // Update game state
      await db
        .update(tttGames)
        .set({
          board: newBoard,
          moveCount: newMoveCount,
          lastMoveAt: new Date(),
        })
        .where(eq(tttGames.matchId, match_id));

      // Update match as draw
      await db
        .update(matches)
        .set({
          status: "draw",
          completedAt: new Date(),
          player1EloChange: p1Change,
          player2EloChange: p2Change,
          payoutTx: [refundTx1, refundTx2].filter(Boolean).join(",") || null,
        })
        .where(eq(matches.id, match_id));

      // Update player stats
      await db
        .update(players)
        .set({
          eloRating: p1.eloRating + p1Change,
          draws: p1.draws + 1,
          totalMatches: p1.totalMatches + 1,
          updatedAt: new Date(),
        })
        .where(eq(players.id, match.player1Id));

      await db
        .update(players)
        .set({
          eloRating: p2.eloRating + p2Change,
          draws: p2.draws + 1,
          totalMatches: p2.totalMatches + 1,
          updatedAt: new Date(),
        })
        .where(eq(players.id, match.player2Id));

      return NextResponse.json({
        status: "match_draw",
        board: newBoard,
        board_grid: boardToGrid(newBoard),
        refund_tx_player1: refundTx1,
        refund_tx_player2: refundTx2,
        move_number: newMoveCount,
      });
    }

    // Game continues - switch turn
    await db
      .update(tttGames)
      .set({
        board: newBoard,
        currentTurn: opponentId,
        moveCount: newMoveCount,
        lastMoveAt: new Date(),
      })
      .where(eq(tttGames.matchId, match_id));

    return NextResponse.json({
      status: "move_accepted",
      board: newBoard,
      board_grid: boardToGrid(newBoard),
      current_turn: opponentId,
      move_number: newMoveCount,
      message: "Waiting for opponent's move...",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
