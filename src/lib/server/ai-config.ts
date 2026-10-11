import "server-only";

/** Default model if ANTHROPIC_MODEL is unset. Overridable per deployment without a code change. */
export const DEFAULT_MODEL = "claude-opus-5-5";

/** Models that accept the server-side `fallbacks: "default"` refusal fallback on the Claude API. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

export function aiConfigured(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.trim().length > 0;
}

export function aiModel(): string {
  const m = process.env.ANTHROPIC_MODEL?.trim();
  return m && /^[a-z0-9.\-:@]{3,80}$/i.test(m) ? m : DEFAULT_MODEL;
}

export function supportsDefaultFallback(model: string): boolean {
  return FALLBACK_MODELS.has(model);
}

function intEnv(name: string, def: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : def;
}

export const AI_LIMITS = {
  perMinute: intEnv("AI_RATE_PER_MINUTE", 4, 60),
  perDayPerClient: intEnv("AI_RATE_PER_DAY", 30, 1000),
  perDayGlobal: intEnv("AI_DAILY_CAP", 300, 10_000),
  maxTokens: 4000,
  timeoutMs: 30_000,
};
