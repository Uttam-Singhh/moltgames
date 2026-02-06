import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { LeaderboardQuerySchema } from "@/types";
import { db } from "@/db";
import { players } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = LeaderboardQuerySchema.parse({
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 20,
    });

    const offset = (query.page - 1) * query.limit;

    const leaderboard = await db
      .select({
        id: players.id,
        username: players.username,
        avatarUrl: players.avatarUrl,
        eloRating: players.eloRating,
        wins: players.wins,
        losses: players.losses,
        draws: players.draws,
        totalMatches: players.totalMatches,
        totalEarnings: players.totalEarnings,
      })
      .from(players)
      .orderBy(desc(players.eloRating))
      .limit(query.limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(players);

    return NextResponse.json({
      leaderboard: leaderboard.map((p, i) => ({
        rank: offset + i + 1,
        id: p.id,
        username: p.username,
        avatar_url: p.avatarUrl,
        elo_rating: p.eloRating,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        total_matches: p.totalMatches,
        total_earnings: p.totalEarnings,
      })),
      page: query.page,
      limit: query.limit,
      total: Number(count),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
