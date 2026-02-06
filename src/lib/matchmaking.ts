import { db } from "@/db";
import { queue, matches, rounds, players } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { ENTRY_FEE_USDC } from "./constants";

export interface QueueEntry {
  id: string;
  playerId: string;
  walletAddress: string | null;
  paymentReceipt: string | null;
  eloRating: number;
  joinedAt: Date;
}

export async function addToQueue(
  playerId: string,
  walletAddress: string | null,
  paymentReceipt: string | null,
  eloRating: number
): Promise<QueueEntry> {
  const [entry] = await db
    .insert(queue)
    .values({
      playerId,
      walletAddress,
      paymentReceipt,
      eloRating,
    })
    .onConflictDoUpdate({
      target: queue.playerId,
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

export async function removeFromQueue(playerId: string): Promise<QueueEntry | null> {
  const [removed] = await db
    .delete(queue)
    .where(eq(queue.playerId, playerId))
    .returning();

  return removed ?? null;
}

export async function getQueueEntry(playerId: string): Promise<QueueEntry | null> {
  const [entry] = await db
    .select()
    .from(queue)
    .where(eq(queue.playerId, playerId))
    .limit(1);

  return entry ?? null;
}

export async function tryMatchPlayers(): Promise<{
  matched: boolean;
  matchId?: string;
  player1Id?: string;
  player2Id?: string;
} | null> {
  // Get all queue entries ordered by join time
  const entries = await db
    .select()
    .from(queue)
    .orderBy(asc(queue.joinedAt));

  if (entries.length < 2) {
    return null;
  }

  let player1Entry: QueueEntry;
  let player2Entry: QueueEntry;

  if (entries.length < 5) {
    // FIFO — match first two
    player1Entry = entries[0];
    player2Entry = entries[1];
  } else {
    // Match closest ELO pair
    let bestPair: [QueueEntry, QueueEntry] | null = null;
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

  // Atomically delete both players and verify they were actually in the queue
  // This prevents double-matching if another process already took them
  const [deleted1] = await db
    .delete(queue)
    .where(eq(queue.playerId, player1Entry.playerId))
    .returning();

  if (!deleted1) {
    // Player 1 was already matched by another process
    console.log("[MATCHMAKING] Player 1 already removed from queue");
    return null;
  }

  const [deleted2] = await db
    .delete(queue)
    .where(eq(queue.playerId, player2Entry.playerId))
    .returning();

  if (!deleted2) {
    // Player 2 was already matched - restore player 1 to queue
    console.log("[MATCHMAKING] Player 2 already removed, restoring player 1");
    await db.insert(queue).values({
      playerId: deleted1.playerId,
      walletAddress: deleted1.walletAddress,
      paymentReceipt: deleted1.paymentReceipt,
      eloRating: deleted1.eloRating,
      joinedAt: deleted1.joinedAt,
    });
    return null;
  }

  // Both players successfully removed from queue - create the match
  const [match] = await db
    .insert(matches)
    .values({
      player1Id: player1Entry.playerId,
      player2Id: player2Entry.playerId,
      entryFee: ENTRY_FEE_USDC,
      player1PaymentReceipt: player1Entry.paymentReceipt,
      player2PaymentReceipt: player2Entry.paymentReceipt,
      currentRound: 1,
    })
    .returning();

  // Create first round
  await db.insert(rounds).values({
    matchId: match.id,
    roundNumber: 1,
  });

  return {
    matched: true,
    matchId: match.id,
    player1Id: player1Entry.playerId,
    player2Id: player2Entry.playerId,
  };
}

export async function getQueuePosition(
  playerId: string
): Promise<{ inQueue: boolean; position?: number; totalInQueue?: number }> {
  const entries = await db
    .select({ playerId: queue.playerId })
    .from(queue)
    .orderBy(asc(queue.joinedAt));

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
