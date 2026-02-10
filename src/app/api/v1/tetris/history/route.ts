import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, players, tetrisGames } from "@/db/schema";
import { eq, desc, or, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10))
    );
    const offset = (page - 1) * limit;

    const pastMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.gameType, "tetris"),
          or(
            eq(matches.status, "completed"),
            eq(matches.status, "forfeited"),
            eq(matches.status, "draw")
          )
        )
      )
      .orderBy(desc(matches.completedAt))
      .limit(limit)
      .offset(offset);

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

    // Fetch tetris game states for scores
    const gameMap = new Map<string, { p1Score: number; p2Score: number }>();
    for (const m of pastMatches) {
      const [game] = await db
        .select({
          p1Score: tetrisGames.player1Score,
          p2Score: tetrisGames.player2Score,
        })
        .from(tetrisGames)
        .where(eq(tetrisGames.matchId, m.id))
        .limit(1);
      if (game) gameMap.set(m.id, game);
    }

    const formatted = pastMatches.map((m) => {
      const scores = gameMap.get(m.id);
      return {
        id: m.id,
        game_type: "tetris",
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
        player1_score: scores?.p1Score ?? 0,
        player2_score: scores?.p2Score ?? 0,
        winner_id: m.winnerId,
        status: m.status,
        entry_fee: m.entryFee,
        payout_tx: m.payoutTx,
        created_at: m.createdAt.toISOString(),
        completed_at: m.completedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      matches: formatted,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
