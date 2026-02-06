import { NextResponse } from "next/server";
import { RefreshRequestSchema } from "@/types";
import { verifySignature, signJwt } from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RefreshRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request body", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { wallet_address, message, signature } = parsed.data;

    // Verify the message starts with the expected prefix and is recent
    if (!message.startsWith("moltgames-refresh-")) {
      throw new ApiError(400, "Invalid refresh message format");
    }

    const timestamp = parseInt(message.split("-").pop() || "0");
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (timestamp < fiveMinutesAgo) {
      throw new ApiError(400, "Refresh message is too old");
    }

    // Verify signature
    const valid = await verifySignature(
      message,
      signature as `0x${string}`,
      wallet_address
    );
    if (!valid) {
      throw new ApiError(400, "Invalid signature");
    }

    // Find player by wallet
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.walletAddress, wallet_address.toLowerCase()))
      .limit(1);

    if (!player) {
      // Try case-insensitive match
      const allPlayers = await db.select().from(players);
      const matched = allPlayers.find(
        (p) =>
          p.walletAddress?.toLowerCase() === wallet_address.toLowerCase()
      );
      if (!matched) {
        throw new ApiError(
          404,
          "No player found with this wallet address"
        );
      }

      const token = await signJwt({
        sub: matched.id,
        username: matched.username,
        wallet: matched.walletAddress ?? undefined,
      });

      return NextResponse.json({ token });
    }

    const token = await signJwt({
      sub: player.id,
      username: player.username,
      wallet: player.walletAddress ?? undefined,
    });

    return NextResponse.json({ token });
  } catch (error) {
    return handleApiError(error);
  }
}
