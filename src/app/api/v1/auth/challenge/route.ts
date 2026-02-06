import { NextResponse } from "next/server";
import { generateChallenge } from "@/lib/auth";
import { handleApiError } from "@/lib/errors";

export async function POST() {
  try {
    const { code, expiresAt } = await generateChallenge();

    return NextResponse.json({
      code,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
