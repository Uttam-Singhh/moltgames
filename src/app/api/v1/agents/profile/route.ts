import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await authenticateRequest(request);

    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      throw new ApiError(400, "Missing 'name' query parameter");
    }

    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.username, name))
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
