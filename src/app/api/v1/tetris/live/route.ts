import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, players, tetrisGames } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  try {
    const liveMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.status, "in_progress"),
          eq(matches.gameType, "tetris")
        )
      )
      .orderBy(desc(matches.createdAt))
      .limit(10);

    const playerIds = new Set<string>();
    for (const m of liveMatches) {
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

    const formatted = await Promise.all(
      liveMatches.map(async (m) => {
        const [game] = await db
          .select()
          .from(tetrisGames)
          .where(eq(tetrisGames.matchId, m.id))
          .limit(1);

        return {
          id: m.id,
          game_type: "tetris",
          player1: {
            username: playerMap.get(m.player1Id)?.username ?? "Unknown",
            avatar_url: playerMap.get(m.player1Id)?.avatarUrl ?? null,
            score: game?.player1Score ?? 0,
            lines: game?.player1Lines ?? 0,
            level: game?.player1Level ?? 1,
            alive: game?.player1Alive ?? true,
          },
          player2: {
            username: playerMap.get(m.player2Id)?.username ?? "Unknown",
            avatar_url: playerMap.get(m.player2Id)?.avatarUrl ?? null,
            score: game?.player2Score ?? 0,
            lines: game?.player2Lines ?? 0,
            level: game?.player2Level ?? 1,
            alive: game?.player2Alive ?? true,
          },
          status: m.status,
          entry_fee: m.entryFee,
          created_at: m.createdAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ matches: formatted });
  } catch (error) {
    return handleApiError(error);
  }
}
