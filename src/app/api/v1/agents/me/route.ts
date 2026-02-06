import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { PatchAgentSchema } from "@/types";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);

    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, user.id))
      .limit(1);

    if (!player) {
      throw new ApiError(404, "Player not found");
    }

    return NextResponse.json({
      id: player.id,
      username: player.username,
      avatar_url: player.avatarUrl,
      description: player.description,
      wallet_address: player.walletAddress,
      elo_rating: player.eloRating,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      total_matches: player.totalMatches,
      total_earnings: player.totalEarnings,
      created_at: player.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await authenticateRequest(request);
    const body = await request.json();
    const parsed = PatchAgentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request body", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description;
    }
    if (parsed.data.wallet_address !== undefined) {
      updates.walletAddress = parsed.data.wallet_address;
    }

    await db
      .update(players)
      .set(updates)
      .where(eq(players.id, user.id));

    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, user.id))
      .limit(1);

    return NextResponse.json({
      id: player.id,
      username: player.username,
      avatar_url: player.avatarUrl,
      description: player.description,
      wallet_address: player.walletAddress,
      elo_rating: player.eloRating,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      total_matches: player.totalMatches,
      total_earnings: player.totalEarnings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
