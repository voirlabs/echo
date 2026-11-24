// In-memory fixed-window rate limiter. Edge-safe (Map + Date.now
// only). State lives in the running process, which suits a single app
// instance. To run several, swap this for a shared store such as Redis.

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // seconds
}

export function rateLimit(id: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Opportunistic GC so the map can't grow unbounded under attack.
  if (store.size > 10_000) {
    for (const [k, v] of store) if (now >= v.resetAt) store.delete(k);
  }

  const entry = store.get(id);
  if (!entry || now >= entry.resetAt) {
    store.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  entry.count += 1;
  if (entry.count > max) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}
