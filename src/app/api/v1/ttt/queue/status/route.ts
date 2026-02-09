import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { getTttQueuePosition, tryMatchTttPlayers } from "@/lib/ttt-matchmaking";
import { checkAndResolveTttTimeout } from "@/lib/ttt-timeout";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, or, desc, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);

    // Try to match while polling
    await tryMatchTttPlayers();

    // Check if still in queue
    const queueStatus = await getTttQueuePosition(user.id);

    if (queueStatus.inQueue) {
      return NextResponse.json({
        status: "queued",
        position: queueStatus.position,
        total_in_queue: queueStatus.totalInQueue,
      });
    }

    // Not in queue - check if matched to a TTT game
    const [recentMatch] = await db
      .select()
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, user.id),
            eq(matches.player2Id, user.id)
          ),
          eq(matches.gameType, "ttt")
        )
      )
      .orderBy(desc(matches.createdAt))
      .limit(1);

    if (recentMatch && recentMatch.status === "in_progress") {
      await checkAndResolveTttTimeout(recentMatch.id);

      const [updated] = await db
        .select()
        .from(matches)
        .where(eq(matches.id, recentMatch.id))
        .limit(1);

      if (updated && updated.status === "in_progress") {
        return NextResponse.json({
          status: "matched",
          match_id: updated.id,
        });
      }
    }

    return NextResponse.json({
      status: "not_in_queue",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
