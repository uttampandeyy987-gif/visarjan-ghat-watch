import { fmtNum } from "./format";
import { CATEGORY_META, describeReading, type SiteAssessment } from "./screening";
import type { Reading } from "./types";

export type ExplainResponse =
  | { mode: "ai"; text: string; model: string; fallbackUsed: boolean; view: string }
  | { mode: "automatic"; text: string; reason: string; view: string };

/** The only data the model sees: already-calculated findings for one site in one view. */
export interface EvidencePayload {
  view: string;
  site: string;
  water_bodies: string[];
  site_match_confidence: "high" | "medium";
  category: string;
  category_rule: string;
  benchmarks: string;
  counts: { parameter: string; measured: number; failing: number; not_sampled: number; expected: number }[];
  failing_readings: { parameter: string; value: number; event: string; phase: string; report_page: number }[];
  missing_tables: string[];
  coverage_percent: number;
  evidence_strength: string;
  reasons: string[];
  data_notes: string[];
}

export function buildEvidencePayload(a: SiteAssessment, readings: Reading[], view: string): EvidencePayload {
  const byId = new Map(readings.map((r) => [r.id, r]));
  const failing = (["do", "bod", "ph"] as const)
    .flatMap((k) => a.stats[k].failingIds)
    .map((id) => byId.get(id))
    .filter((r): r is Reading => !!r)
    .slice(0, 40);
  return {
    view,
    site: a.site,
    water_bodies: a.waterBodies,
    site_match_confidence: a.matchConfidence,
    category: CATEGORY_META[a.category].label,
    category_rule: CATEGORY_META[a.category].rule,
    benchmarks: "CPCB Class B (organised outdoor bathing): pH 6.5–8.5, dissolved oxygen at least 5 mg/L, BOD at most 3 mg/L. No Class B limit exists for the other parameters.",
    counts: (["do", "bod", "ph"] as const).map((k) => ({
      parameter: k === "do" ? "Dissolved oxygen" : k === "bod" ? "BOD" : "pH",
      measured: a.stats[k].measured,
      failing: a.stats[k].fails,
      not_sampled: a.stats[k].notSampled,
      expected: a.stats[k].expected,
    })),
    failing_readings: failing.map((r) => ({ parameter: r.parameter, value: r.value as number, event: `${r.festival} ${r.year}`, phase: r.phase, report_page: r.sourcePage })),
    missing_tables: a.missingEvents.map((e) => `${e.festival} ${e.year}`),
    coverage_percent: Math.round(a.coverage * 100),
    evidence_strength: a.evidence,
    reasons: a.reasons.map((r) => r.text),
    data_notes: [
      "Readings are historical (2023–2025 MPPCB immersion reports), not current conditions.",
      "Units are assumed; the reports print none.",
      "BDL means below detection limit: very low, not zero. Blank, '_' and '*' cells mean not sampled, not clean.",
      ...a.evidenceNotes,
    ],
  };
}

export const SYSTEM_PROMPT = `You write short explanations for a Bhopal Municipal Corporation planning officer preparing for Durga visarjan. You explain screening results that have already been calculated by deterministic code from historical MPPCB water-quality readings.

Rules:
- Use only facts, numbers and report page numbers that appear in the evidence JSON, written as digits exactly as they appear there. Do not introduce any other number, date, page, site, standard or source, and do not compute new figures.
- Explain why the site received its category, using the category label exactly as given. Do not change, soften or upgrade it, and do not name any other category.
- Say that the readings are historical and do not describe current water quality, and that this is a screening aid, not a regulatory determination (use those words).
- Mention data gaps (not-sampled cells, missing tables, medium site-match confidence) where they exist. Never describe missing or below-detection readings as clean or safe.
- Do not describe the water as safe, clean or suitable for any use, and do not describe health effects, causes of pollution, or outcomes that the evidence does not state.
- Write two short paragraphs, at most 170 words in total. Plain text only: no headings, lists, markdown or quotation of these rules.`;

export function deterministicExplanation(a: SiteAssessment, view: string): string {
  const m = CATEGORY_META[a.category];
  const parts: string[] = [];
  parts.push(`${a.site} is listed as ${m.label.toLowerCase()} for ${view}. ${m.rule}`);
  const concern = a.reasons.filter((r) => r.kind !== "caveat").map((r) => r.text);
  if (concern.length) parts.push(concern.join(" "));
  const gaps = [
    `${Math.round(a.coverage * 100)}% of the expected DO, BOD and pH readings are measured values.`,
    a.matchConfidence === "medium" ? "The site name in the reports may cover two different places." : "",
  ].filter(Boolean).join(" ");
  parts.push(`${gaps} These are historical readings from the 2023–2025 MPPCB immersion reports, not current water quality, and this screening is not a regulatory determination.`);
  return parts.join("\n\n");
}

// ---------- Output checks ----------

function allowedNumbers(p: EvidencePayload): Set<string> {
  const nums = new Set<string>();
  const add = (n: number) => { nums.add(String(n)); nums.add(fmtNum(n)); };
  const walk = (v: unknown) => {
    if (typeof v === "number") add(v);
    else if (typeof v === "string") for (const m of v.match(/\d+(?:\.\d+)?/g) ?? []) add(Number(m));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(p);
  // Small counting words the model may legitimately write as digits ("two paragraphs", "one week").
  for (const n of [1, 2, 3, 100]) add(n);
  return nums;
}

export interface CheckResult { ok: boolean; problems: string[] }

const CATEGORY_LABELS = ["High priority", "Elevated priority", "Monitor", "Insufficient data"];
const REASSURING = /\b(safe|clean|suitable|acceptable|fit for|harmless|unpolluted|healthy|no (?:cause for )?concern|no risk|no problem)\b/gi;
const NEGATOR = /\b(not|never|cannot|nor|without|no evidence)\b|n't\b/;
const SPELLED_NUMBER = /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/i;

/**
 * Rejects drafts that cite unknown pages or numbers, restate a different category,
 * claim the water is safe or clean, omit the historical/non-regulatory caveat, or are malformed.
 * A rejected draft is never shown; the deterministic summary is used instead.
 */
export function checkAiText(text: string, p: EvidencePayload): CheckResult {
  const problems: string[] = [];
  const t = text.trim();
  if (t.length < 80) problems.push("too short");
  if (t.length > 1800) problems.push("too long");
  if (/[<>]|```|^#|\*\*/m.test(t)) problems.push("markup in output");

  // Every page number after a page keyword ("p. 26", "pages 26 and 28", "pp. 26–28") must be an evidence page.
  const pages = new Set(p.failing_readings.map((r) => r.report_page));
  for (const m of t.matchAll(/\b(?:pp?|pages?)\.?\s*(\d+(?:\s*(?:,|and|&|–|-|to)\s*\d+)*)/gi)) {
    for (const n of m[1].match(/\d+/g) ?? []) if (!pages.has(Number(n))) problems.push(`page ${n} not in evidence`);
  }

  // Every figure, including ones glued to units ("1.7mg/L", "pH12") and grouped thousands ("1,000").
  const allowed = allowedNumbers(p);
  for (const m of t.matchAll(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\d.,])\d+(?:\.\d+)?/g)) {
    const n = m[0].replace(/,/g, "");
    if (!allowed.has(n) && !allowed.has(String(Number(n)))) problems.push(`number ${m[0]} not in evidence`);
  }
  if (SPELLED_NUMBER.test(t)) problems.push("spelled-out number");

  // The category must be restated as calculated, and no other category may be claimed.
  const lower = t.toLowerCase();
  if (!lower.includes(p.category.toLowerCase())) problems.push("category not stated");
  for (const label of CATEGORY_LABELS) {
    if (label === p.category) continue;
    const re = label === "Monitor" ? /\b(?:as|is|category(?: of)?|classed|classified)\s+["'“]?monitor\b/i : new RegExp(`\\b${label}\\b`, "i");
    if (re.test(t)) problems.push(`claims category ${label}`);
  }

  // Reassuring words count only if negated within the same clause, within the few words before them.
  for (const m of t.matchAll(REASSURING)) {
    const head = t.slice(0, m.index);
    const clause = head.slice(Math.max(...[". ", "! ", "? ", "\n", ";", ":", ","].map((s) => head.lastIndexOf(s))) + 1);
    const window = clause.trim().split(/\s+/).slice(-8).join(" ").toLowerCase();
    if (!NEGATOR.test(window)) problems.push(`reassuring claim "${m[0]}"`);
  }
  if (/\b(prove[sn]?|guarantee[sd]?|certif(y|ies|ied))\b/i.test(t)) problems.push("overclaims");

  if (!/historical/i.test(t)) problems.push("missing historical caveat");
  if (!/\bnot (?:a |an )?(?:official )?regulatory\b/i.test(t)) problems.push("missing non-regulatory caveat");
  return { ok: problems.length === 0, problems };
}

export function describeFailing(r: Reading): string {
  return `${r.parameter} ${fmtNum(r.value as number)} (${describeReading(r)})`;
}
