import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { handleX402Payment, sendRefund } from "@/lib/x402";
import {
  addToTttQueue,
  removeFromTttQueue,
  getTttQueueEntry,
  tryMatchTttPlayers,
} from "@/lib/ttt-matchmaking";
import { getQueueEntry } from "@/lib/matchmaking";
import { db } from "@/db";
import { players, matches } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const user = await authenticateRequest(request);

    // Check if player is already in TTT queue
    const existingTtt = await getTttQueueEntry(user.id);
    if (existingTtt) {
      throw new ApiError(409, "Already in TTT queue", "ALREADY_IN_QUEUE");
    }

    // Check if player is in RPS queue
    const existingRps = await getQueueEntry(user.id);
    if (existingRps) {
      throw new ApiError(
        409,
        "You are in the RPS queue. Leave it first.",
        "IN_OTHER_QUEUE"
      );
    }

    // Check if player has an active match
    const [activeMatch] = await db
      .select()
      .from(matches)
      .where(
        and(
          or(
            eq(matches.player1Id, user.id),
            eq(matches.player2Id, user.id)
          ),
          eq(matches.status, "in_progress")
        )
      )
      .limit(1);

    if (activeMatch) {
      throw new ApiError(
        409,
        "You have an active match. Finish it first.",
        "ACTIVE_MATCH"
      );
    }

    // Settle x402 payment
    const payment = await handleX402Payment(request);

    if (!payment.success) {
      return new NextResponse(JSON.stringify(payment.responseBody), {
        status: payment.status,
        headers: {
          "Content-Type": "application/json",
          ...(payment.responseHeaders || {}),
        },
      });
    }

    // Get player's current ELO
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, user.id))
      .limit(1);

    if (!player) {
      throw new ApiError(404, "Player not found");
    }

    // Update wallet address if needed
    let walletAddress = player.walletAddress;
    if (!walletAddress && payment.payerAddress) {
      walletAddress = payment.payerAddress;
      await db
        .update(players)
        .set({
          walletAddress: payment.payerAddress,
          updatedAt: new Date(),
        })
        .where(eq(players.id, user.id));
    }

    // Add to TTT queue
    await addToTttQueue(
      user.id,
      walletAddress,
      payment.receipt ?? null,
      player.eloRating
    );

    // Try to match immediately
    const matchResult = await tryMatchTttPlayers();

    if (matchResult?.matched) {
      return NextResponse.json({
        status: "matched",
        match_id: matchResult.matchId,
      });
    }

    return NextResponse.json({
      status: "queued",
      position: 1,
      message: "Waiting for TTT opponent...",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await authenticateRequest(request);

    const entry = await removeFromTttQueue(user.id);
    if (!entry) {
      throw new ApiError(404, "Not in TTT queue", "NOT_IN_QUEUE");
    }

    if (entry.paymentReceipt && entry.walletAddress) {
      const refundTx = await sendRefund(entry.walletAddress);
      return NextResponse.json({
        status: "left_queue",
        refund_tx: refundTx,
      });
    }

    return NextResponse.json({ status: "left_queue" });
  } catch (error) {
    return handleApiError(error);
  }
}
