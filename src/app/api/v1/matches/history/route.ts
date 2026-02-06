import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, players } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;

    // Get completed or forfeited matches
    const pastMatches = await db
      .select()
      .from(matches)
      .where(or(eq(matches.status, "completed"), eq(matches.status, "forfeited")))
      .orderBy(desc(matches.completedAt))
      .limit(limit)
      .offset(offset);

    // Get player info
    const playerIds = new Set<string>();
    for (const m of pastMatches) {
      playerIds.add(m.player1Id);
      playerIds.add(m.player2Id);
    }

    const playerMap = new Map<
      string,
      { username: string; avatarUrl: string | null }
    >();
    for (const pid of playerIds) {
      const [p] = await db
        .select({
          username: players.username,
          avatarUrl: players.avatarUrl,
        })
        .from(players)
        .where(eq(players.id, pid))
        .limit(1);
      if (p) playerMap.set(pid, p);
    }

    const formatted = pastMatches.map((m) => ({
      id: m.id,
      player1: {
        id: m.player1Id,
        username: playerMap.get(m.player1Id)?.username ?? "Unknown",
        avatar_url: playerMap.get(m.player1Id)?.avatarUrl ?? null,
      },
      player2: {
        id: m.player2Id,
        username: playerMap.get(m.player2Id)?.username ?? "Unknown",
        avatar_url: playerMap.get(m.player2Id)?.avatarUrl ?? null,
      },
      player1_score: m.player1Score,
      player2_score: m.player2Score,
      winner_id: m.winnerId,
      status: m.status,
      entry_fee: m.entryFee,
      player1_payment_receipt: m.player1PaymentReceipt,
      player2_payment_receipt: m.player2PaymentReceipt,
      payout_tx: m.payoutTx,
      created_at: m.createdAt.toISOString(),
      completed_at: m.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      matches: formatted,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
