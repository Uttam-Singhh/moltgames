import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { db } from "@/db";
import { matches, players, tttGames } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { boardToGrid } from "@/lib/ttt-game-logic";

export async function GET() {
  try {
    const liveMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.status, "in_progress"),
          eq(matches.gameType, "ttt")
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
          .from(tttGames)
          .where(
            and(
              eq(tttGames.matchId, m.id),
              eq(tttGames.roundNumber, m.currentRound)
            )
          )
          .limit(1);

        return {
          id: m.id,
          game_type: "ttt",
          player1: {
            username: playerMap.get(m.player1Id)?.username ?? "Unknown",
            avatar_url: playerMap.get(m.player1Id)?.avatarUrl ?? null,
          },
          player2: {
            username: playerMap.get(m.player2Id)?.username ?? "Unknown",
            avatar_url: playerMap.get(m.player2Id)?.avatarUrl ?? null,
          },
          board: game?.board ?? "---------",
          board_grid: boardToGrid(game?.board ?? "---------"),
          move_count: game?.moveCount ?? 0,
          current_turn: game?.currentTurn ?? null,
          player1_score: m.player1Score,
          player2_score: m.player2Score,
          current_round: m.currentRound,
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
