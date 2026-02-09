import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { db } from "@/db";
import { tttQueue, players } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const entries = await db
      .select({
        id: tttQueue.id,
        playerId: tttQueue.playerId,
        eloRating: tttQueue.eloRating,
        walletAddress: tttQueue.walletAddress,
        joinedAt: tttQueue.joinedAt,
      })
      .from(tttQueue)
      .orderBy(asc(tttQueue.joinedAt))
      .limit(20);

    const formatted = [];
    for (const entry of entries) {
      const [p] = await db
        .select({
          username: players.username,
          avatarUrl: players.avatarUrl,
        })
        .from(players)
        .where(eq(players.id, entry.playerId))
        .limit(1);

      formatted.push({
        username: p?.username ?? "Unknown",
        avatar_url: p?.avatarUrl ?? null,
        elo_rating: entry.eloRating,
        wallet_address: entry.walletAddress,
        joined_at: entry.joinedAt.toISOString(),
      });
    }

    return NextResponse.json({ queue: formatted, count: formatted.length });
  } catch (error) {
    return handleApiError(error);
  }
}
