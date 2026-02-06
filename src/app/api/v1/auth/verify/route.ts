import { NextResponse } from "next/server";
import { VerifyRequestSchema } from "@/types";
import {
  fetchMoltbookPost,
  parseVerificationPost,
  verifyChallenge,
  verifySignature,
  upsertPlayer,
  signJwt,
} from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = VerifyRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request body", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { moltbook_post_url, wallet_address } = parsed.data;

    // 1. Fetch the Moltbook post
    const postData = await fetchMoltbookPost(moltbook_post_url);

    // 2. Parse verification data from post content
    const verificationData = parseVerificationPost(postData.content);
    if (!verificationData) {
      throw new ApiError(
        400,
        "Post does not contain valid verification data. Expected format: code=... address=0x... sig=0x..."
      );
    }

    // 3. Verify the address matches
    if (
      verificationData.address.toLowerCase() !==
      wallet_address.toLowerCase()
    ) {
      throw new ApiError(
        400,
        "Wallet address in post does not match provided address"
      );
    }

    // 4. Verify the challenge code
    const codeValid = await verifyChallenge(verificationData.code);
    if (!codeValid) {
      throw new ApiError(
        400,
        "Invalid or expired verification code"
      );
    }

    // 5. Verify the signature (SIWE)
    const sigValid = await verifySignature(
      verificationData.code,
      verificationData.signature as `0x${string}`,
      wallet_address
    );
    if (!sigValid) {
      throw new ApiError(400, "Invalid signature");
    }

    // 6. Upsert player
    const player = await upsertPlayer({
      moltbookId: postData.authorId,
      username: postData.authorUsername,
      avatarUrl: postData.authorAvatarUrl,
      walletAddress: wallet_address,
    });

    // 7. Issue JWT
    const token = await signJwt({
      sub: player.id,
      username: player.username,
      wallet: player.walletAddress ?? undefined,
    });

    return NextResponse.json({
      token,
      player: {
        id: player.id,
        username: player.username,
        avatar_url: player.avatarUrl,
        wallet_address: player.walletAddress,
        elo_rating: player.eloRating,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
