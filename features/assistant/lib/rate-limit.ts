/** A limit: at most `max` requests per `windowMs`. */
export type RateLimit = { max: number; windowMs: number };

/** Whether a request may go on; if not, in how many seconds it may again. */
export type RateDecision = { isAllowed: true } | { isAllowed: false; retryAfterS: number };

/** A key's count in its current window, and when that window ends, ms since the epoch. */
type Window = { count: number; endsAt: number };

/** How often the windows that have ended are dropped, so the map does not grow with every address seen. */
const PRUNE_EVERY_MS = 10 * 60_000;

/**
 * Fixed-window counters, by key (a client's address, or one key for all),
 * in this server's memory: they reset when it restarts, and each replica
 * counts its own — enough for the one replica the chart runs.
 */
export function createRateLimiter(limits: readonly RateLimit[]) {
  const windows = limits.map(() => new Map<string, Window>());
  let prunedAt = Date.now();

  function prune(now: number) {
    if (now - prunedAt < PRUNE_EVERY_MS) return;
    prunedAt = now;
    for (const byKey of windows) {
      for (const [key, window] of byKey) if (window.endsAt <= now) byKey.delete(key);
    }
  }

  /** Counts a request for `key` against every limit — only when all of them allow it. */
  function take(key: string): RateDecision {
    const now = Date.now();
    prune(now);
    const current = limits.map((limit, index) => {
      const window = windows[index].get(key);
      return window && window.endsAt > now ? window : { count: 0, endsAt: now + limit.windowMs };
    });
    const blocked = current
      .map((window, index) => (window.count >= limits[index].max ? window.endsAt : null))
      .filter((endsAt): endsAt is number => endsAt !== null);
    if (blocked.length > 0) return { isAllowed: false, retryAfterS: Math.ceil((Math.max(...blocked) - now) / 1000) };
    current.forEach((window, index) => windows[index].set(key, { ...window, count: window.count + 1 }));
    return { isAllowed: true };
  }

  return { take };
}

/**
 * The client's address, as the ingress saw it: X-Real-IP, which ingress-nginx
 * sets itself, or else the last X-Forwarded-For entry — the one the nearest
 * proxy added, not one the client could have written.
 */
export function clientAddress(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || "unknown";
}
