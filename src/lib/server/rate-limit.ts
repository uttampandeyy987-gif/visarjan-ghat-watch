import "server-only";

/**
 * Fixed-window counters held in memory. On serverless platforms each instance
 * keeps its own counters, so this limits abuse per instance rather than globally.
 * The per-day global cap bounds worst-case API spend per instance.
 */
interface Window { count: number; resetAt: number }

const buckets = new Map<string, Window>();
const MAX_KEYS = 5000;

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterS: number } {
  let w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.delete(buckets.keys().next().value as string);
    }
    w = { count: 0, resetAt: now + windowMs };
    buckets.set(key, w);
  }
  if (w.count >= limit) return { ok: false, retryAfterS: Math.ceil((w.resetAt - now) / 1000) };
  w.count++;
  return { ok: true, retryAfterS: 0 };
}

export function clientKey(headers: Headers): string {
  // Vercel sets x-forwarded-for; take the first (client) address only.
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}

export function resetRateLimits() {
  buckets.clear();
}
