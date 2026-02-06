import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { MatchListQuerySchema } from "@/types";
import { db } from "@/db";
import { matches, players } from "@/db/schema";
import { eq, or, desc, and, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);

    const { searchParams } = new URL(request.url);
    const query = MatchListQuerySchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
      status: searchParams.get("status") ?? undefined,
    });

    const offset = (query.page - 1) * query.limit;

    const conditions = [
      or(
        eq(matches.player1Id, user.id),
        eq(matches.player2Id, user.id)
      ),
    ];

    if (query.status) {
      conditions.push(eq(matches.status, query.status));
    }

    const userMatches = await db
      .select()
      .from(matches)
      .where(and(...conditions))
      .orderBy(desc(matches.createdAt))
      .limit(query.limit)
      .offset(offset);

    // Get player names for all matches
    const playerIds = new Set<string>();
    for (const m of userMatches) {
      playerIds.add(m.player1Id);
      playerIds.add(m.player2Id);
    }

    const playerMap = new Map<string, { username: string; avatarUrl: string | null }>();
    for (const pid of playerIds) {
      const [p] = await db
        .select({ username: players.username, avatarUrl: players.avatarUrl })
        .from(players)
        .where(eq(players.id, pid))
        .limit(1);
      if (p) playerMap.set(pid, p);
    }

    const formatted = userMatches.map((m) => ({
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
      status: m.status,
      player1_score: m.player1Score,
      player2_score: m.player2Score,
      current_round: m.currentRound,
      winner_id: m.winnerId,
      entry_fee: m.entryFee,
      payout_tx: m.payoutTx,
      created_at: m.createdAt.toISOString(),
      completed_at: m.completedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      matches: formatted,
      page: query.page,
      limit: query.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
