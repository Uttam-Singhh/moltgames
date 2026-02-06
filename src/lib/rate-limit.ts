const windowMs = 60_000;
const store = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store) {
    if (value.resetAt < now) {
      store.delete(key);
    }
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMillis: number = windowMs
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMillis });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMillis };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}
