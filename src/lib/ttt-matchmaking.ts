import { db } from "@/db";
import { tttQueue, matches, tttGames, players } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { ENTRY_FEE_USDC } from "./constants";

export interface TttQueueEntry {
  id: string;
  playerId: string;
  walletAddress: string | null;
  paymentReceipt: string | null;
  eloRating: number;
  joinedAt: Date;
}

export async function addToTttQueue(
  playerId: string,
  walletAddress: string | null,
  paymentReceipt: string | null,
  eloRating: number
): Promise<TttQueueEntry> {
  const [entry] = await db
    .insert(tttQueue)
    .values({
      playerId,
      walletAddress,
      paymentReceipt,
      eloRating,
    })
    .onConflictDoUpdate({
      target: tttQueue.playerId,
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

export async function removeFromTttQueue(
  playerId: string
): Promise<TttQueueEntry | null> {
  const [removed] = await db
    .delete(tttQueue)
    .where(eq(tttQueue.playerId, playerId))
    .returning();

  return removed ?? null;
}

export async function getTttQueueEntry(
  playerId: string
): Promise<TttQueueEntry | null> {
  const [entry] = await db
    .select()
    .from(tttQueue)
    .where(eq(tttQueue.playerId, playerId))
    .limit(1);

  return entry ?? null;
}

export async function getTttQueuePosition(
  playerId: string
): Promise<{ inQueue: boolean; position?: number; totalInQueue?: number }> {
  const entries = await db
    .select({ playerId: tttQueue.playerId })
    .from(tttQueue)
    .orderBy(asc(tttQueue.joinedAt));

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

export async function tryMatchTttPlayers(): Promise<{
  matched: boolean;
  matchId?: string;
  player1Id?: string;
  player2Id?: string;
} | null> {
  const entries = await db
    .select()
    .from(tttQueue)
    .orderBy(asc(tttQueue.joinedAt));

  if (entries.length < 2) {
    return null;
  }

  let player1Entry: TttQueueEntry;
  let player2Entry: TttQueueEntry;

  if (entries.length < 5) {
    player1Entry = entries[0];
    player2Entry = entries[1];
  } else {
    let bestPair: [TttQueueEntry, TttQueueEntry] | null = null;
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
    .delete(tttQueue)
    .where(eq(tttQueue.playerId, player1Entry.playerId))
    .returning();

  if (!deleted1) {
    console.log("[TTT-MATCHMAKING] Player 1 already removed from queue");
    return null;
  }

  const [deleted2] = await db
    .delete(tttQueue)
    .where(eq(tttQueue.playerId, player2Entry.playerId))
    .returning();

  if (!deleted2) {
    console.log("[TTT-MATCHMAKING] Player 2 already removed, restoring player 1");
    await db.insert(tttQueue).values({
      playerId: deleted1.playerId,
      walletAddress: deleted1.walletAddress,
      paymentReceipt: deleted1.paymentReceipt,
      eloRating: deleted1.eloRating,
      joinedAt: deleted1.joinedAt,
    });
    return null;
  }

  // Create match with gameType "ttt"
  const [match] = await db
    .insert(matches)
    .values({
      gameType: "ttt",
      player1Id: player1Entry.playerId,
      player2Id: player2Entry.playerId,
      entryFee: ENTRY_FEE_USDC,
      player1PaymentReceipt: player1Entry.paymentReceipt,
      player2PaymentReceipt: player2Entry.paymentReceipt,
      currentRound: 1,
    })
    .returning();

  // Initialize TTT game state: player1 = X, goes first
  await db.insert(tttGames).values({
    matchId: match.id,
    roundNumber: 1,
    currentTurn: player1Entry.playerId,
    board: "---------",
    moveCount: 0,
  });

  return {
    matched: true,
    matchId: match.id,
    player1Id: player1Entry.playerId,
    player2Id: player2Entry.playerId,
  };
}
