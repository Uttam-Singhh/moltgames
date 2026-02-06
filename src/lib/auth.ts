import { SignJWT, jwtVerify } from "jose";
import { verifyMessage } from "viem";
import { db } from "@/db";
import { challenges, players } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  JWT_EXPIRY_HOURS,
  CHALLENGE_EXPIRY_MINUTES,
} from "./constants";
import { ApiError } from "./errors";
import type { JwtPayload } from "@/types";

const jwtSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET!);

export async function generateChallenge(): Promise<{
  code: string;
  expiresAt: Date;
}> {
  const code = `moltgames-verify-${uuidv4().slice(0, 8)}`;
  const expiresAt = new Date(
    Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000
  );

  await db.insert(challenges).values({ code, expiresAt });

  return { code, expiresAt };
}

export async function verifyChallenge(code: string): Promise<boolean> {
  const [challenge] = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.code, code),
        eq(challenges.used, false),
        gt(challenges.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!challenge) return false;

  await db
    .update(challenges)
    .set({ used: true })
    .where(eq(challenges.id, challenge.id));

  return true;
}

export async function verifySignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: string
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: expectedAddress as `0x${string}`,
      message,
      signature,
    });
    return valid;
  } catch {
    return false;
  }
}

export interface MoltbookPostData {
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  content: string;
}

export async function fetchMoltbookPost(
  postUrl: string
): Promise<MoltbookPostData> {
  // Extract post ID from URL
  const match = postUrl.match(/\/post\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new ApiError(400, "Invalid Moltbook post URL");

  const postId = match[1];
  const apiKey = process.env.MOLTBOOK_API_KEY;

  const response = await fetch(
    `https://www.moltbook.com/api/v1/posts/${postId}`,
    {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    }
  );

  if (!response.ok) {
    throw new ApiError(400, "Could not fetch Moltbook post");
  }

  const data = await response.json();
  const post = data.post ?? data;

  return {
    authorId: String(post.author?.id ?? post.user_id ?? post.authorId),
    authorUsername:
      post.author?.name ?? post.author?.username ?? post.username ?? post.authorUsername,
    authorAvatarUrl:
      post.author?.avatar_url ??
      post.avatar_url ??
      post.authorAvatarUrl ??
      null,
    content: post.content ?? post.text ?? post.body ?? "",
  };
}

export function parseVerificationPost(content: string): {
  code: string;
  address: string;
  signature: string;
} | null {
  const codeMatch = content.match(/code=(\S+)/);
  const addressMatch = content.match(/address=(0x[a-fA-F0-9]{40})/);
  const sigMatch = content.match(/sig=(0x[a-fA-F0-9]+)/);

  if (!codeMatch || !addressMatch || !sigMatch) return null;

  return {
    code: codeMatch[1],
    address: addressMatch[1],
    signature: sigMatch[1],
  };
}

export async function signJwt(payload: {
  sub: string;
  username: string;
  wallet?: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_HOURS}h`)
    .sign(jwtSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as unknown as JwtPayload;
  } catch {
    throw new ApiError(401, "Invalid or expired token", "UNAUTHORIZED");
  }
}

export async function authenticateRequest(
  request: Request
): Promise<{ id: string; username: string; wallet?: string }> {
  const authHeader = request.headers.get("authorization");
  console.log("[AUTH] authHeader", authHeader);
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing authorization header", "UNAUTHORIZED");
  } 

  const token = authHeader.slice(7);
  console.log("[AUTH] token", token);
  const payload = await verifyJwt(token);

  return {
    id: payload.sub,
    username: payload.username,
    wallet: payload.wallet,
  };
}

export async function upsertPlayer(data: {
  moltbookId: string;
  username: string;
  avatarUrl: string | null;
  walletAddress: string;
}) {
  const existing = await db
    .select()
    .from(players)
    .where(eq(players.moltbookId, data.moltbookId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(players)
      .set({
        username: data.username,
        avatarUrl: data.avatarUrl,
        walletAddress: data.walletAddress,
        updatedAt: new Date(),
      })
      .where(eq(players.moltbookId, data.moltbookId));

    return (
      await db
        .select()
        .from(players)
        .where(eq(players.moltbookId, data.moltbookId))
        .limit(1)
    )[0];
  }

  const [player] = await db
    .insert(players)
    .values({
      moltbookId: data.moltbookId,
      username: data.username,
      avatarUrl: data.avatarUrl,
      walletAddress: data.walletAddress,
    })
    .returning();

  return player;
}
