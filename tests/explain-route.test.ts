import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic extends actual.default {
    constructor(opts: ConstructorParameters<typeof actual.default>[0]) {
      super(opts);
      (this as unknown as { beta: unknown }).beta = { messages: { create } };
    }
  }
  return { ...actual, default: FakeAnthropic };
});

const Anthropic = (await import("@anthropic-ai/sdk")).default;
const { POST } = await import("@/app/api/explain/route");
const { resetRateLimits } = await import("@/lib/server/rate-limit");

const VALID =
  "Malikhedi kund is listed as high priority because dissolved oxygen was below 5 mg/L in 9 of 13 measured readings (69%). " +
  "BOD was above 3 mg/L in 11 of 13 measured readings.\n\nThese are historical readings, not current water quality, and this screening is not a regulatory determination. " +
  "No table was published for Durga 2025.";

let n = 0;
function req(body: unknown, ip = "198.51.100.7") {
  return new Request("http://localhost:3000/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", "sec-fetch-site": "same-origin", host: "localhost:3000", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}
// Each call uses a view never requested before, so the response cache cannot mask behaviour.
const VIEWS = [2023, 2024, 2025].flatMap((year) => (["pre", "during", "after"] as const).map((phase) => ({ year, phase })));
const body = () => ({ siteId: "malikhedi-kund", festival: "all", ...VIEWS[n++] });
const msg = (text: string, extra: Record<string, unknown> = {}) => ({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }], usage: { iterations: [] }, ...extra });

describe("POST /api/explain with Claude configured (SDK mocked)", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    delete process.env.ANTHROPIC_MODEL;
    create.mockReset();
    resetRateLimits();
  });

  it("returns the AI draft when it passes the evidence checks, and sends only minimal evidence", async () => {
    create.mockResolvedValue(msg(VALID));
    const res = await POST(req({ siteId: "malikhedi-kund", year: "all", festival: "all", phase: "all" }));
    const j = await res.json();
    expect(j).toMatchObject({ mode: "ai", model: "claude-opus-5-5", fallbackUsed: false });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBeLessThanOrEqual(4000);
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.thinking).toBeUndefined();
    const sent = params.messages[0].content as string;
    expect(sent.length).toBeLessThan(12_000);
    expect(sent).not.toContain("test-key-not-real");
    expect(sent).toContain("Malikhedi kund");
    expect(sent).not.toContain("Khatlapura"); // other sites are not sent
  });

  it("serves a repeat request from cache without calling Claude again", async () => {
    create.mockResolvedValue(msg(VALID));
    await POST(req({ siteId: "malikhedi-kund", year: "all", festival: "all", phase: "all" }));
    await POST(req({ siteId: "malikhedi-kund", year: "all", festival: "all", phase: "all" }));
    expect(create).toHaveBeenCalledTimes(0); // cached by the previous test's identical view
  });

  it("falls back to the automatic summary when the draft invents a page", async () => {
    create.mockResolvedValue(msg(VALID + " See report p. 99."));
    const j = await (await POST(req(body()))).json();
    expect(j.mode).toBe("automatic");
    expect(j.reason).toMatch(/evidence checks/);
    expect(j.text).toMatch(/insufficient data/); // 2023, pre only: 2 DO readings → cannot be screened
    expect(j.text).not.toContain("p. 99");
  });

  it("handles refusal and truncation", async () => {
    create.mockResolvedValueOnce(msg("", { stop_reason: "refusal" }));
    expect((await (await POST(req(body()))).json()).reason).toMatch(/declined/);
    create.mockResolvedValueOnce(msg(VALID.slice(0, 50), { stop_reason: "max_tokens" }));
    expect((await (await POST(req(body()))).json()).reason).toMatch(/cut off/);
  });

  it("reports a rejected key or unavailable model without leaking details", async () => {
    create.mockRejectedValueOnce(new Anthropic.AuthenticationError(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, "invalid x-api-key", new Headers()));
    const a = await (await POST(req(body()))).json();
    expect(a).toMatchObject({ mode: "automatic", reason: "The configured Claude API key was rejected." });
    expect(JSON.stringify(a)).not.toContain("x-api-key");

    process.env.ANTHROPIC_MODEL = "claude-made-up-9";
    create.mockRejectedValueOnce(new Anthropic.NotFoundError(404, { type: "error", error: { type: "not_found_error", message: "model" } }, "model", new Headers()));
    const b = await (await POST(req(body()))).json();
    expect(b.reason).toContain("claude-made-up-9");
    expect(create.mock.calls.at(-1)![0].fallbacks).toBeUndefined(); // unknown model: no fallback param
  });

  it("rate-limits per client and returns 429 with the automatic summary", async () => {
    create.mockResolvedValue(msg(VALID));
    const views = ["all", "pre", "during", "after"].flatMap((phase) => [2023, 2024].map((year) => ({ siteId: "prempura-ghat", year, festival: "all", phase })));
    const statuses: number[] = [];
    for (const v of views.slice(0, 6)) statuses.push((await POST(req(v, "192.0.2.50"))).status);
    expect(statuses.slice(0, 4)).toEqual([200, 200, 200, 200]);
    expect(statuses[4]).toBe(429);
    const other = await POST(req(views[6], "192.0.2.51"));
    expect(other.status).toBe(200);
  });

  it("uses the automatic summary and never calls Claude when no key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const j = await (await POST(req(body()))).json();
    expect(j.mode).toBe("automatic");
    expect(create).not.toHaveBeenCalled();
  });
});
