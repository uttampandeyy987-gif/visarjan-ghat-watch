import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildEvidencePayload, checkAiText, deterministicExplanation, SYSTEM_PROMPT, type ExplainResponse } from "@/lib/explain";
import { applyScope, describeFilters } from "@/lib/filters";
import { assessSites, siteCatalog } from "@/lib/screening";
import { AI_LIMITS, aiConfigured, aiModel, supportsDefaultFallback } from "@/lib/server/ai-config";
import { loadDataset } from "@/lib/server/load-dataset";
import { clientKey, hit } from "@/lib/server/rate-limit";
import { DEFAULT_FILTERS, FESTIVALS, PHASES, type Filters } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BODY_BYTES = 1024;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const BodySchema = z
  .object({
    siteId: z.string().regex(/^[a-z0-9-]{1,80}$/),
    year: z.union([z.literal("all"), z.number().int().min(2000).max(2100)]),
    festival: z.union([z.literal("all"), z.enum(FESTIVALS)]),
    phase: z.union([z.literal("all"), z.enum(PHASES)]),
  })
  .strict();

const cache = new Map<string, { at: number; body: ExplainResponse }>();

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

/** Blocks cross-site use of the endpoint (cost abuse / CSRF). Browsers always send these on fetch POSTs. */
function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return site === "same-origin";
  try {
    return new URL(origin).host === new URL(req.url).host || origin === `https://${req.headers.get("host")}` || origin === `http://${req.headers.get("host")}`;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Cross-origin requests are not accepted." }, 403);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Expected application/json." }, 415);

  // Refuse oversized bodies before reading them when the size is declared, and in bytes afterwards.
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: "Request body too large." }, 413);
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return json({ error: "Request body too large." }, 413);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json({ error: "Malformed JSON." }, 400);
  }
  const parsed = BodySchema.safeParse(parsedJson);
  if (!parsed.success) return json({ error: "Invalid request." }, 400);

  const ds = loadDataset();
  const catalog = siteCatalog(ds.readings);
  const info = catalog.find((s) => s.siteId === parsed.data.siteId);
  if (!info) return json({ error: "Unknown site." }, 404);
  if (parsed.data.year !== "all" && !ds.readings.some((r) => r.year === parsed.data.year)) return json({ error: "Unknown year." }, 404);

  // Recompute findings server-side: nothing the client says about values is trusted.
  const filters: Filters = { ...DEFAULT_FILTERS, ...parsed.data, site: info.siteId };
  const scoped = applyScope(ds.readings, filters);
  const universe = applyScope(ds.readings, { ...filters, site: "all" });
  const [assessment] = assessSites(scoped, universe, [info]);
  const view = describeFilters(filters, () => info.site);
  const automatic = (reason: string): ExplainResponse => ({ mode: "automatic", text: deterministicExplanation(assessment, view), reason, view });

  if (!aiConfigured()) return json(automatic("Claude is not configured on this deployment."));

  const key = JSON.stringify(filters);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return json(cached.body);

  const who = clientKey(req.headers);
  for (const [k, limit, ms] of [
    [`m:${who}`, AI_LIMITS.perMinute, 60_000],
    [`d:${who}`, AI_LIMITS.perDayPerClient, 86_400_000],
    ["global", AI_LIMITS.perDayGlobal, 86_400_000],
  ] as const) {
    const r = hit(k, limit, ms);
    if (!r.ok) return json({ ...automatic("The AI request limit was reached; showing the automatic summary."), retryAfterS: r.retryAfterS }, 429, { "Retry-After": String(r.retryAfterS) });
  }

  const payload = buildEvidencePayload(assessment, scoped, view);
  const model = aiModel();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: AI_LIMITS.timeoutMs, maxRetries: 1 });

  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: AI_LIMITS.maxTokens,
      output_config: { effort: "medium" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Evidence JSON:\n${JSON.stringify(payload)}\n\nWrite the explanation.` }],
      ...(supportsDefaultFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    if (response.stop_reason === "refusal") return json(automatic("Claude declined this request; showing the automatic summary."));
    if (response.stop_reason === "max_tokens") return json(automatic("Claude’s draft was cut off; showing the automatic summary."));

    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    const check = checkAiText(text, payload);
    if (!check.ok) {
      console.warn("explain: AI draft rejected by checks:", check.problems.slice(0, 5).join("; "));
      return json(automatic("Claude’s draft did not pass the evidence checks, so it is not shown."));
    }
    const fallbackUsed = (response.usage.iterations ?? []).some((e) => e.type === "fallback_message");
    const body: ExplainResponse = { mode: "ai", text, model: response.model, fallbackUsed, view };
    cache.set(key, { at: Date.now(), body });
    return json(body);
  } catch (err) {
    // Log the error class and status only — never the key, prompt or payload.
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("explain: Claude rejected the API credentials", err.status);
      return json(automatic("The configured Claude API key was rejected."));
    }
    if (err instanceof Anthropic.NotFoundError) {
      console.error("explain: model not found for this key", err.status);
      return json(automatic(`The configured model (${model}) is not available to this API key.`));
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("explain: Claude rejected the request parameters", err.status);
      return json(automatic("Claude rejected the request parameters for the configured model."));
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error("explain: Claude rate limited", err.status);
      return json(automatic("Claude is rate limited right now."));
    }
    if (err instanceof Anthropic.APIError) {
      console.error("explain: Claude API error", err.status);
      return json(automatic("Claude is unavailable right now."));
    }
    console.error("explain: request failed", err instanceof Error ? err.name : "unknown");
    return json(automatic("Claude could not be reached."));
  }
}
