import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple in-memory rate limiter for edge runtime
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const key = ip;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}

export function middleware(request: NextRequest) {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // 100 requests per minute globally
  const allowed = rateLimit(ip, 100, 60_000);

  if (!allowed) {
    return NextResponse.json(
      { error: { message: "Rate limit exceeded", code: "RATE_LIMITED" } },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
