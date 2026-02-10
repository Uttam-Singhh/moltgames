import { db } from "@/db";
import { tetrisQueue, matches, tetrisGames, players } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { ENTRY_FEE_USDC } from "./constants";

export interface TetrisQueueEntry {
  id: string;
  playerId: string;
  walletAddress: string | null;
  paymentReceipt: string | null;
  eloRating: number;
  joinedAt: Date;
}

export async function addToTetrisQueue(
  playerId: string,
  walletAddress: string | null,
  paymentReceipt: string | null,
  eloRating: number
): Promise<TetrisQueueEntry> {
  const [entry] = await db
    .insert(tetrisQueue)
    .values({
      playerId,
      walletAddress,
      paymentReceipt,
      eloRating,
    })
    .onConflictDoUpdate({
      target: tetrisQueue.playerId,
      set: {
        walletAddress,
        paymentReceipt,
        eloRating,
        joinedAt: new Date(),
      },
    })
    .returning();

  return entry;
}

export async function removeFromTetrisQueue(
  playerId: string
): Promise<TetrisQueueEntry | null> {
  const [removed] = await db
    .delete(tetrisQueue)
    .where(eq(tetrisQueue.playerId, playerId))
    .returning();

  return removed ?? null;
}

export async function getTetrisQueueEntry(
  playerId: string
): Promise<TetrisQueueEntry | null> {
  const [entry] = await db
    .select()
    .from(tetrisQueue)
    .where(eq(tetrisQueue.playerId, playerId))
    .limit(1);

  return entry ?? null;
}

export async function getTetrisQueuePosition(
  playerId: string
): Promise<{ inQueue: boolean; position?: number; totalInQueue?: number }> {
  const entries = await db
    .select({ playerId: tetrisQueue.playerId })
    .from(tetrisQueue)
    .orderBy(asc(tetrisQueue.joinedAt));

  const idx = entries.findIndex((e) => e.playerId === playerId);
  if (idx === -1) {
    return { inQueue: false };
  }

  return {
    inQueue: true,
    position: idx + 1,
    totalInQueue: entries.length,
  };
}

export async function tryMatchTetrisPlayers(): Promise<{
  matched: boolean;
  matchId?: string;
  player1Id?: string;
  player2Id?: string;
} | null> {
  const entries = await db
    .select()
    .from(tetrisQueue)
    .orderBy(asc(tetrisQueue.joinedAt));

  if (entries.length < 2) {
    return null;
  }

  let player1Entry: TetrisQueueEntry;
  let player2Entry: TetrisQueueEntry;

  if (entries.length < 5) {
    player1Entry = entries[0];
    player2Entry = entries[1];
  } else {
    let bestPair: [TetrisQueueEntry, TetrisQueueEntry] | null = null;
    let bestDiff = Infinity;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const diff = Math.abs(
          entries[i].eloRating - entries[j].eloRating
        );
        if (diff < bestDiff) {
          bestDiff = diff;
          bestPair = [entries[i], entries[j]];
        }
      }
    }

    if (!bestPair) return null;
    [player1Entry, player2Entry] = bestPair;
  }

  // Atomically delete both players
  const [deleted1] = await db
    .delete(tetrisQueue)
    .where(eq(tetrisQueue.playerId, player1Entry.playerId))
    .returning();

  if (!deleted1) {
    console.log("[TETRIS-MATCHMAKING] Player 1 already removed from queue");
    return null;
  }

  const [deleted2] = await db
    .delete(tetrisQueue)
    .where(eq(tetrisQueue.playerId, player2Entry.playerId))
    .returning();

  if (!deleted2) {
    console.log(
      "[TETRIS-MATCHMAKING] Player 2 already removed, restoring player 1"
    );
    await db.insert(tetrisQueue).values({
      playerId: deleted1.playerId,
      walletAddress: deleted1.walletAddress,
      paymentReceipt: deleted1.paymentReceipt,
      eloRating: deleted1.eloRating,
      joinedAt: deleted1.joinedAt,
    });
    return null;
  }

  // Create match with gameType "tetris"
  const [match] = await db
    .insert(matches)
    .values({
      gameType: "tetris",
      player1Id: player1Entry.playerId,
      player2Id: player2Entry.playerId,
      entryFee: ENTRY_FEE_USDC,
      player1PaymentReceipt: player1Entry.paymentReceipt,
      player2PaymentReceipt: player2Entry.paymentReceipt,
      currentRound: 1,
    })
    .returning();

  // Generate shared seed for fair piece sequence
  const seed = crypto.randomUUID();

  // Initialize Tetris game state
  await db.insert(tetrisGames).values({
    matchId: match.id,
    seed,
  });

  return {
    matched: true,
    matchId: match.id,
    player1Id: player1Entry.playerId,
    player2Id: player2Entry.playerId,
  };
}
