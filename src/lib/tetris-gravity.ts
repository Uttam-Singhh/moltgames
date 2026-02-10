import { db } from "@/db";
import { matches, tetrisGames, tetrisMoves, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getPieceAtIndex,
  getAutoDropPlacement,
  applyMove,
  calculateGravityInterval,
  hasAnyValidPlacement,
} from "./tetris-game-logic";
import { calculateEloChange } from "./elo";
import { sendPayout } from "./x402";
import { ENTRY_FEE_USDC } from "./constants";
import type { TetrisPiece } from "@/types";

interface GravityResult {
  gameEnded: boolean;
  winnerId?: string;
  loserId?: string;
  payoutTx?: string | null;
}

export async function processGravityDrops(
  matchId: string
): Promise<GravityResult> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.status !== "in_progress" || match.gameType !== "tetris") {
    return { gameEnded: false };
  }

  const [game] = await db
    .select()
    .from(tetrisGames)
    .where(eq(tetrisGames.matchId, matchId))
    .limit(1);

  if (!game) return { gameEnded: false };

  const now = Date.now();
  let updated = false;

  // Process player 1 gravity
  if (game.player1Alive) {
    const p1Result = await processPlayerGravity(
      matchId,
      match.player1Id,
      game.player1Board,
      game.player1Score,
      game.player1Lines,
      game.player1Level,
      game.player1PieceIndex,
      game.player1PendingGarbage,
      game.player1LastMoveAt,
      game.seed,
      "player1",
      now
    );

    if (p1Result.movesApplied > 0) {
      await db
        .update(tetrisGames)
        .set({
          player1Board: p1Result.board,
          player1Score: p1Result.score,
          player1Lines: p1Result.lines,
          player1Level: p1Result.level,
          player1PieceIndex: p1Result.pieceIndex,
          player1PendingGarbage: 0,
          player1Alive: p1Result.alive,
          player1LastMoveAt: new Date(p1Result.lastMoveAt),
        })
        .where(eq(tetrisGames.matchId, matchId));
      updated = true;

      // Add garbage sent to opponent
      if (p1Result.totalGarbageSent > 0) {
        await db
          .update(tetrisGames)
          .set({
            player2PendingGarbage:
              game.player2PendingGarbage + p1Result.totalGarbageSent,
          })
          .where(eq(tetrisGames.matchId, matchId));
      }
    }
  }

  // Re-fetch game state for player 2 (player 1 may have changed garbage)
  const [freshGame] = await db
    .select()
    .from(tetrisGames)
    .where(eq(tetrisGames.matchId, matchId))
    .limit(1);

  if (!freshGame) return { gameEnded: false };

  // Process player 2 gravity
  if (freshGame.player2Alive) {
    const p2Result = await processPlayerGravity(
      matchId,
      match.player2Id,
      freshGame.player2Board,
      freshGame.player2Score,
      freshGame.player2Lines,
      freshGame.player2Level,
      freshGame.player2PieceIndex,
      freshGame.player2PendingGarbage,
      freshGame.player2LastMoveAt,
      freshGame.seed,
      "player2",
      now
    );

    if (p2Result.movesApplied > 0) {
      await db
        .update(tetrisGames)
        .set({
          player2Board: p2Result.board,
          player2Score: p2Result.score,
          player2Lines: p2Result.lines,
          player2Level: p2Result.level,
          player2PieceIndex: p2Result.pieceIndex,
          player2PendingGarbage: 0,
          player2Alive: p2Result.alive,
          player2LastMoveAt: new Date(p2Result.lastMoveAt),
        })
        .where(eq(tetrisGames.matchId, matchId));
      updated = true;

      // Add garbage sent to opponent
      if (p2Result.totalGarbageSent > 0) {
        await db
          .update(tetrisGames)
          .set({
            player1PendingGarbage:
              freshGame.player1PendingGarbage + p2Result.totalGarbageSent,
          })
          .where(eq(tetrisGames.matchId, matchId));
      }
    }
  }

  // Re-fetch final state to check game end
  const [finalGame] = await db
    .select()
    .from(tetrisGames)
    .where(eq(tetrisGames.matchId, matchId))
    .limit(1);

  if (!finalGame) return { gameEnded: false };

  // Check if game ended
  const p1Alive = finalGame.player1Alive;
  const p2Alive = finalGame.player2Alive;

  if (!p1Alive && !p2Alive) {
    // Both dead — tiebreak by most lines cleared
    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (finalGame.player1Lines > finalGame.player2Lines) {
      winnerId = match.player1Id;
      loserId = match.player2Id;
    } else if (finalGame.player2Lines > finalGame.player1Lines) {
      winnerId = match.player2Id;
      loserId = match.player1Id;
    }

    if (winnerId && loserId) {
      return await resolveMatchWin(matchId, match, winnerId, loserId);
    } else {
      // True draw — refund both
      return await resolveMatchDraw(matchId, match);
    }
  }

  if (!p1Alive && p2Alive) {
    return await resolveMatchWin(
      matchId,
      match,
      match.player2Id,
      match.player1Id
    );
  }

  if (p1Alive && !p2Alive) {
    return await resolveMatchWin(
      matchId,
      match,
      match.player1Id,
      match.player2Id
    );
  }

  return { gameEnded: false };
}

interface PlayerGravityResult {
  board: string;
  score: number;
  lines: number;
  level: number;
  pieceIndex: number;
  alive: boolean;
  lastMoveAt: number;
  movesApplied: number;
  totalGarbageSent: number;
}

async function processPlayerGravity(
  matchId: string,
  playerId: string,
  board: string,
  score: number,
  lines: number,
  level: number,
  pieceIndex: number,
  pendingGarbage: number,
  lastMoveAt: Date,
  seed: string,
  playerLabel: string,
  now: number
): Promise<PlayerGravityResult> {
  let currentBoard = board;
  let currentScore = score;
  let currentLines = lines;
  let currentLevel = level;
  let currentPieceIndex = pieceIndex;
  let currentPendingGarbage = pendingGarbage;
  let currentLastMoveAt = lastMoveAt.getTime();
  let alive = true;
  let movesApplied = 0;
  let totalGarbageSent = 0;

  // Get existing move count for this player
  const existingMoves = await db
    .select({ moveNumber: tetrisMoves.moveNumber })
    .from(tetrisMoves)
    .where(eq(tetrisMoves.matchId, matchId))
    .orderBy(tetrisMoves.moveNumber);

  let nextMoveNumber =
    existingMoves.length > 0
      ? existingMoves[existingMoves.length - 1].moveNumber + 1
      : 1;

  while (alive) {
    const gravityInterval = calculateGravityInterval(currentLevel) * 1000;
    const timeSinceMove = now - currentLastMoveAt;

    if (timeSinceMove < gravityInterval) break;

    // Auto-drop this piece
    const piece = getPieceAtIndex(seed, currentPieceIndex) as TetrisPiece;

    // Check if any placement is possible
    if (!hasAnyValidPlacement(currentBoard, piece)) {
      alive = false;
      break;
    }

    const placement = getAutoDropPlacement(currentBoard, piece);
    if (!placement) {
      alive = false;
      break;
    }

    const result = applyMove(
      currentBoard,
      piece,
      placement.rotation,
      placement.column,
      currentPendingGarbage,
      currentScore,
      currentLines,
      currentLevel,
      seed,
      currentPieceIndex
    );

    // Record auto-drop move
    await db.insert(tetrisMoves).values({
      matchId,
      playerId,
      piece,
      rotation: placement.rotation,
      column: placement.column,
      linesCleared: result.linesCleared,
      garbageSent: result.garbageSent,
      garbageReceived: result.garbageReceived,
      scoreAfter: result.newScore,
      levelAfter: result.newLevel,
      boardAfter: result.newBoard,
      moveNumber: nextMoveNumber,
      isAutoDrop: true,
    });

    currentBoard = result.newBoard;
    currentScore = result.newScore;
    currentLines = result.newLines;
    currentLevel = result.newLevel;
    currentPieceIndex++;
    currentPendingGarbage = 0;
    currentLastMoveAt = currentLastMoveAt + gravityInterval;
    alive = result.alive;
    movesApplied++;
    nextMoveNumber++;
    totalGarbageSent += result.garbageSent;
  }

  return {
    board: currentBoard,
    score: currentScore,
    lines: currentLines,
    level: currentLevel,
    pieceIndex: currentPieceIndex,
    alive,
    lastMoveAt: movesApplied > 0 ? currentLastMoveAt : lastMoveAt.getTime(),
    movesApplied,
    totalGarbageSent,
  };
}

async function resolveMatchWin(
  matchId: string,
  match: { player1Id: string; player2Id: string },
  winnerId: string,
  loserId: string
): Promise<GravityResult> {
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

  if (!winner || !loser) return { gameEnded: true };

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
    .where(eq(matches.id, matchId));

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

  return { gameEnded: true, winnerId, loserId, payoutTx };
}

async function resolveMatchDraw(
  matchId: string,
  match: { player1Id: string; player2Id: string }
): Promise<GravityResult> {
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

  if (!p1 || !p2) return { gameEnded: true };

  const { calculateEloChangeDraw } = await import("./elo");
  const { sendRefund } = await import("./x402");

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
      player1EloChange: p1Change,
      player2EloChange: p2Change,
      payoutTx: [refundTx1, refundTx2].filter(Boolean).join(",") || null,
    })
    .where(eq(matches.id, matchId));

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

  return { gameEnded: true };
}
