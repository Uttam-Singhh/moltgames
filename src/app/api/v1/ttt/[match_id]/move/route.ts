import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { SubmitTttMoveSchema } from "@/types";
import { db } from "@/db";
import { matches, tttGames, tttMoves, players } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  isValidMove,
  applyMove,
  checkTttGameEnd,
  checkTttMatchEnd,
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

    // Get game state for current round
    const [game] = await db
      .select()
      .from(tttGames)
      .where(
        and(
          eq(tttGames.matchId, match_id),
          eq(tttGames.roundNumber, match.currentRound)
        )
      )
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
      roundNumber: match.currentRound,
      playerId: user.id,
      position,
      symbol,
      moveNumber: newMoveCount,
      reasoning: reasoning ?? null,
    });

    // Check if this round ended
    const gameEnd = checkTttGameEnd(newBoard);

    if (gameEnd.ended && gameEnd.winner) {
      // Round winner — award POINTS_PER_WIN
      const roundWinnerId = user.id;
      const newP1Score =
        match.player1Score +
        (roundWinnerId === match.player1Id ? TTT_CONSTANTS.POINTS_PER_WIN : 0);
      const newP2Score =
        match.player2Score +
        (roundWinnerId === match.player2Id ? TTT_CONSTANTS.POINTS_PER_WIN : 0);

      // Update game state with winner
      await db
        .update(tttGames)
        .set({
          board: newBoard,
          moveCount: newMoveCount,
          winnerId: roundWinnerId,
          lastMoveAt: new Date(),
        })
        .where(eq(tttGames.id, game.id));

      // Check if match is over
      const matchEnd = checkTttMatchEnd(
        newP1Score,
        newP2Score,
        match.currentRound
      );

      if (matchEnd.ended) {
        // Match is over — determine winner by higher score
        const matchWinnerId =
          newP1Score > newP2Score ? match.player1Id : match.player2Id;
        const matchLoserId =
          matchWinnerId === match.player1Id
            ? match.player2Id
            : match.player1Id;

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

        // Update match
        await db
          .update(matches)
          .set({
            winnerId: matchWinnerId,
            status: "completed",
            completedAt: new Date(),
            player1Score: newP1Score,
            player2Score: newP2Score,
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
          round_number: match.currentRound,
          player1_score: newP1Score,
          player2_score: newP2Score,
        });
      }

      // Match continues — create next round
      const nextRound = match.currentRound + 1;
      // Who goes first alternates: odd rounds → player1, even rounds → player2
      const nextFirstPlayer =
        nextRound % 2 === 1 ? match.player1Id : match.player2Id;

      await db.insert(tttGames).values({
        matchId: match_id,
        roundNumber: nextRound,
        currentTurn: nextFirstPlayer,
        board: "---------",
        moveCount: 0,
      });

      await db
        .update(matches)
        .set({
          currentRound: nextRound,
          player1Score: newP1Score,
          player2Score: newP2Score,
        })
        .where(eq(matches.id, match_id));

      return NextResponse.json({
        status: "round_complete",
        board: newBoard,
        board_grid: boardToGrid(newBoard),
        round_winner_id: roundWinnerId,
        winning_symbol: symbol,
        move_number: newMoveCount,
        round_number: match.currentRound,
        next_round: nextRound,
        player1_score: newP1Score,
        player2_score: newP2Score,
        current_turn: nextFirstPlayer,
        message: `Round ${match.currentRound} won! Starting round ${nextRound}...`,
      });
    }

    if (gameEnd.ended && gameEnd.isDraw) {
      // Round draw — award POINTS_PER_DRAW to each
      const newP1Score = match.player1Score + TTT_CONSTANTS.POINTS_PER_DRAW;
      const newP2Score = match.player2Score + TTT_CONSTANTS.POINTS_PER_DRAW;

      // Update game state with draw
      await db
        .update(tttGames)
        .set({
          board: newBoard,
          moveCount: newMoveCount,
          isDraw: true,
          lastMoveAt: new Date(),
        })
        .where(eq(tttGames.id, game.id));

      // Check if match is over
      const matchEnd = checkTttMatchEnd(
        newP1Score,
        newP2Score,
        match.currentRound
      );

      if (matchEnd.ended) {
        // Match over after draw — determine winner by higher score
        if (newP1Score !== newP2Score) {
          const matchWinnerId =
            newP1Score > newP2Score ? match.player1Id : match.player2Id;
          const matchLoserId =
            matchWinnerId === match.player1Id
              ? match.player2Id
              : match.player1Id;

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

          await db
            .update(matches)
            .set({
              winnerId: matchWinnerId,
              status: "completed",
              completedAt: new Date(),
              player1Score: newP1Score,
              player2Score: newP2Score,
              player1EloChange:
                matchWinnerId === match.player1Id ? winnerChange : loserChange,
              player2EloChange:
                matchWinnerId === match.player2Id ? winnerChange : loserChange,
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
            payout_tx: payoutTx,
            move_number: newMoveCount,
            round_number: match.currentRound,
            player1_score: newP1Score,
            player2_score: newP2Score,
          });
        }

        // Scores are perfectly tied after all rounds — full draw
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

        let refundTx1: string | null = null;
        let refundTx2: string | null = null;
        if (p1.walletAddress) {
          refundTx1 = await sendRefund(p1.walletAddress);
        }
        if (p2.walletAddress) {
          refundTx2 = await sendRefund(p2.walletAddress);
        }

        await db
          .update(matches)
          .set({
            status: "draw",
            completedAt: new Date(),
            player1Score: newP1Score,
            player2Score: newP2Score,
            player1EloChange: p1Change,
            player2EloChange: p2Change,
            payoutTx:
              [refundTx1, refundTx2].filter(Boolean).join(",") || null,
          })
          .where(eq(matches.id, match_id));

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
          round_number: match.currentRound,
          player1_score: newP1Score,
          player2_score: newP2Score,
        });
      }

      // Match continues — create next round (draw in sudden death keeps scores tied → next round)
      const nextRound = match.currentRound + 1;
      const nextFirstPlayer =
        nextRound % 2 === 1 ? match.player1Id : match.player2Id;

      await db.insert(tttGames).values({
        matchId: match_id,
        roundNumber: nextRound,
        currentTurn: nextFirstPlayer,
        board: "---------",
        moveCount: 0,
      });

      await db
        .update(matches)
        .set({
          currentRound: nextRound,
          player1Score: newP1Score,
          player2Score: newP2Score,
        })
        .where(eq(matches.id, match_id));

      return NextResponse.json({
        status: "round_complete",
        board: newBoard,
        board_grid: boardToGrid(newBoard),
        round_result: "draw",
        move_number: newMoveCount,
        round_number: match.currentRound,
        next_round: nextRound,
        player1_score: newP1Score,
        player2_score: newP2Score,
        current_turn: nextFirstPlayer,
        message: `Round ${match.currentRound} drawn! Starting round ${nextRound}...`,
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
      .where(eq(tttGames.id, game.id));

    return NextResponse.json({
      status: "move_accepted",
      board: newBoard,
      board_grid: boardToGrid(newBoard),
      current_turn: opponentId,
      move_number: newMoveCount,
      round_number: match.currentRound,
      player1_score: match.player1Score,
      player2_score: match.player2Score,
      message: "Waiting for opponent's move...",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
