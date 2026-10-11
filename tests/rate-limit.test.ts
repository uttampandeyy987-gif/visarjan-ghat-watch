import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { clientKey, hit, resetRateLimits } = await import("@/lib/server/rate-limit");

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks until the window resets", () => {
    const t0 = 1_000_000;
    expect([1, 2, 3].map(() => hit("ip", 3, 60_000, t0).ok)).toEqual([true, true, true]);
    const blocked = hit("ip", 3, 60_000, t0 + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterS).toBe(59);
    expect(hit("ip", 3, 60_000, t0 + 60_001).ok).toBe(true);
  });

  it("keeps clients independent", () => {
    hit("a", 1, 60_000, 0);
    expect(hit("a", 1, 60_000, 1).ok).toBe(false);
    expect(hit("b", 1, 60_000, 1).ok).toBe(true);
  });

  it("uses only the first forwarded address and bounds its length", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientKey(new Headers({ "x-forwarded-for": "x".repeat(500) })).length).toBe(64);
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
