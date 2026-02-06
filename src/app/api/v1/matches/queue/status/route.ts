import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";
import { getQueuePosition, tryMatchPlayers } from "@/lib/matchmaking";
import { checkAndResolveTimeout } from "@/lib/timeout";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);

    // Try to match while polling
    await tryMatchPlayers();

    // Check if still in queue
    const queueStatus = await getQueuePosition(user.id);

    if (queueStatus.inQueue) {
      return NextResponse.json({
        status: "queued",
        position: queueStatus.position,
        total_in_queue: queueStatus.totalInQueue,
      });
    }

    // Not in queue — check if matched
    const [recentMatch] = await db
      .select()
      .from(matches)
      .where(
        or(
          eq(matches.player1Id, user.id),
          eq(matches.player2Id, user.id)
        )
      )
      .orderBy(desc(matches.createdAt))
      .limit(1);

    if (recentMatch && recentMatch.status === "in_progress") {
      // Check for timeout on this match while we're here
      await checkAndResolveTimeout(recentMatch.id);

      // Re-check status after potential timeout resolution
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
