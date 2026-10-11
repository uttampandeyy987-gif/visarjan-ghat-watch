import { failsClassB, parameterById, SCREENED_PARAMETERS } from "./parameters";
import { PHASES, type Festival, type ParameterId, type Phase, type Reading } from "./types";

export type Category = "high" | "elevated" | "monitor" | "insufficient";
export type EvidenceLevel = "strong" | "moderate" | "limited";

/**
 * Screening thresholds. The Method section renders these same constants,
 * so the documentation cannot drift from the calculation.
 */
export const RULES = {
  /** Fewer measured readings than this for DO or for BOD → Insufficient data. */
  minMeasured: 3,
  /** Share of measured DO readings below the Class B minimum that makes a site High priority. */
  highDoShortfallShare: 0.5,
  /** Share of measured BOD readings above the Class B maximum that alone makes a site Elevated. */
  elevatedBodShare: 0.5,
  /** Coverage at or above this (with a high-confidence site match) → Strong evidence. */
  strongCoverage: 0.9,
  /** Coverage at or above this → Moderate evidence; below → Limited. */
  moderateCoverage: 0.6,
} as const;

export const CATEGORY_META: Record<Category, { label: string; order: number; rule: string }> = {
  insufficient: { label: "Insufficient data", order: 3, rule: `Fewer than ${RULES.minMeasured} measured DO or BOD readings in the current view (or, for a site with no failures, fewer than ${RULES.minMeasured} measured pH readings). The site cannot be screened — this is not a reassuring result.` },
  high: { label: "High priority", order: 0, rule: `Dissolved oxygen below the Class B minimum (5 mg/L) in at least ${RULES.highDoShortfallShare * 100}% of measured DO readings.` },
  elevated: { label: "Elevated priority", order: 1, rule: `Any DO reading below 5 mg/L, or any pH outside 6.5–8.5, or BOD above 3 mg/L in at least ${RULES.elevatedBodShare * 100}% of measured BOD readings.` },
  monitor: { label: "Monitor", order: 2, rule: "Enough measured readings, and none of the conditions above. This is not a finding that the water is safe; most parameters have no Class B limit." },
};

export interface EventKey { year: number; festival: Festival }

export interface ParamStats {
  parameterId: ParameterId;
  expected: number;
  measured: number;
  belowDetection: number;
  notSampled: number;
  /** Slots with no row at all because the report has no table for that event. */
  noTable: number;
  fails: number;
  failShare: number | null;
  failingIds: string[];
  /** Lowest DO, highest BOD, or pH furthest outside 6.5–8.5 (closest to an edge if all within). */
  extreme: Reading | null;
}

export interface Reason {
  kind: "concern" | "data" | "caveat";
  text: string;
  readingIds: string[];
}

export interface SiteAssessment {
  siteId: string;
  site: string;
  waterBodies: string[];
  matchConfidence: "high" | "medium";
  sitesAsPrinted: string[];
  category: Category;
  rank: number;
  reasons: Reason[];
  stats: Record<"do" | "bod" | "ph", ParamStats>;
  coverage: number;
  missingEvents: EventKey[];
  evidence: EvidenceLevel;
  evidenceNotes: string[];
  unverified: number;
  readingIds: string[];
}

const eventLabel = (e: EventKey) => `${e.festival} ${e.year}`;
export const PHASE_LABEL: Record<Phase, string> = { pre: "before immersion", during: "during immersion", after: "one week after" };

export function describeReading(r: Reading): string {
  return `${r.festival} ${r.year}, ${PHASE_LABEL[r.phase]}, report p. ${r.sourcePage}`;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
}
const pct = (x: number) => `${Math.round(x * 100)}%`;

export function eventsIn(readings: Reading[]): EventKey[] {
  const m = new Map<string, EventKey>();
  for (const r of readings) m.set(`${r.year}|${r.festival}`, { year: r.year, festival: r.festival });
  // Ganesh (Aug–Sep) precedes Durga (Oct) within a year.
  return [...m.values()].sort((a, b) => a.year - b.year || (a.festival === "Ganesh" ? -1 : 1) - (b.festival === "Ganesh" ? -1 : 1));
}

function paramStats(rows: Reading[], id: ParameterId, expected: number, noTable: number): ParamStats {
  const own = rows.filter((r) => r.parameterId === id);
  // DO below detection is necessarily below the 5 mg/L minimum, so it counts as a usable, failing reading.
  // (BDL BOD/pH are left out: below detection does not establish where they sit against the limit.)
  const bdlDo = id === "do" ? own.filter((r) => r.status === "below-detection") : [];
  const measured = [...own.filter((r) => r.status === "measured"), ...bdlDo];
  const failing = measured.filter((r) => failsClassB(id, r.value) === true || bdlDo.includes(r));
  let extreme: Reading | null = null;
  const score = (r: Reading) => {
    const v = r.value as number;
    if (id === "do") return -v;
    if (id === "bod") return v;
    return Math.max(6.5 - v, v - 8.5); // pH: positive when outside 6.5–8.5, larger = further out
  };
  for (const r of measured) if (r.value !== null && (!extreme || score(r) > score(extreme))) extreme = r;
  return {
    parameterId: id,
    expected,
    measured: measured.length,
    belowDetection: own.filter((r) => r.status === "below-detection").length - bdlDo.length,
    notSampled: own.filter((r) => r.status === "not-sampled").length,
    noTable,
    fails: failing.length,
    failShare: measured.length ? failing.length / measured.length : null,
    failingIds: failing.map((r) => r.id),
    extreme,
  };
}

export interface SiteInfo { siteId: string; site: string; waterBodies: string[]; matchConfidence: "high" | "medium"; sitesAsPrinted: string[] }

/** One entry per site in the whole dataset, so a site with no rows in a view is still listed. */
export function siteCatalog(all: Reading[]): SiteInfo[] {
  const m = new Map<string, SiteInfo>();
  for (const r of all) {
    const s = m.get(r.siteId) ?? { siteId: r.siteId, site: r.site, waterBodies: [], matchConfidence: "high", sitesAsPrinted: [] };
    if (!s.waterBodies.includes(r.waterBody)) s.waterBodies.push(r.waterBody);
    if (!s.sitesAsPrinted.includes(r.siteAsPrinted)) s.sitesAsPrinted.push(r.siteAsPrinted);
    if (r.siteMatchConfidence === "medium") s.matchConfidence = "medium";
    m.set(r.siteId, s);
  }
  return [...m.values()];
}

/**
 * Assesses every site in `sites`, including sites with no readings in the view.
 * @param scoped   readings after the site/year/festival/phase scope is applied
 * @param universe readings after the year/festival/phase scope only (all sites) — defines which events and phases were expected
 * @param sites    the sites to assess (the catalog, narrowed by the site filter)
 */
export function assessSites(scoped: Reading[], universe: Reading[], sites: SiteInfo[]): SiteAssessment[] {
  const events = eventsIn(universe);
  const phases = PHASES.filter((p) => universe.some((r) => r.phase === p));
  const bySite = new Map<string, Reading[]>(sites.map((s) => [s.siteId, []]));
  for (const r of scoped) bySite.get(r.siteId)?.push(r);

  const out: SiteAssessment[] = [];
  for (const info of sites) {
    const siteId = info.siteId;
    const rows = bySite.get(siteId) ?? [];
    const missingEvents = events.filter((e) => !rows.some((r) => r.year === e.year && r.festival === e.festival));
    const expectedPerParam = events.length * phases.length;
    const noTablePerParam = missingEvents.length * phases.length;
    const stats = {
      do: paramStats(rows, "do", expectedPerParam, noTablePerParam),
      bod: paramStats(rows, "bod", expectedPerParam, noTablePerParam),
      ph: paramStats(rows, "ph", expectedPerParam, noTablePerParam),
    };
    const { do: d, bod: b, ph } = stats;

    // ---- Category (first matching rule wins) ----
    let category: Category;
    if (d.measured < RULES.minMeasured || b.measured < RULES.minMeasured) category = "insufficient";
    else if ((d.failShare ?? 0) >= RULES.highDoShortfallShare) category = "high";
    else if (d.fails > 0 || ph.fails > 0 || (b.failShare ?? 0) >= RULES.elevatedBodShare) category = "elevated";
    // "Monitor" asserts the absence of every screened failure, so it also needs enough pH readings.
    else if (ph.measured < RULES.minMeasured) category = "insufficient";
    else category = "monitor";

    // ---- Reasons, each tied to the readings that support it ----
    const reasons: Reason[] = [];
    if (category === "insufficient" && d.measured >= RULES.minMeasured && b.measured >= RULES.minMeasured) {
      reasons.push({ kind: "data", text: `No DO, BOD or pH failure in this view, but only ${ph.measured} measured pH readings; at least ${RULES.minMeasured} are needed before a site can be listed as Monitor.`, readingIds: rows.filter((r) => r.parameterId === "ph").map((r) => r.id) });
    } else if (category === "insufficient") {
      reasons.push({ kind: "data", text: `Only ${d.measured} measured DO and ${b.measured} measured BOD readings in this view; at least ${RULES.minMeasured} of each are needed to screen.`, readingIds: rows.filter((r) => r.parameterId === "do" || r.parameterId === "bod").map((r) => r.id) });
    }
    if (d.measured) {
      reasons.push({
        kind: d.fails ? "concern" : "data",
        text: d.fails
          ? `DO was below 5 mg/L in ${d.fails} of ${d.measured} measured readings (${pct(d.failShare!)}).`
          : `DO stayed at or above 5 mg/L in all ${d.measured} measured readings.`,
        readingIds: d.fails ? d.failingIds : rows.filter((r) => r.parameterId === "do" && r.status === "measured").map((r) => r.id),
      });
      if (d.extreme && (d.extreme.value as number) < 5) {
        reasons.push({ kind: "concern", text: `Lowest DO: ${fmt(d.extreme.value as number)} mg/L (${describeReading(d.extreme)}).`, readingIds: [d.extreme.id] });
      }
    }
    if (b.measured) {
      reasons.push({
        kind: b.fails ? "concern" : "data",
        text: b.fails
          ? `BOD was above 3 mg/L in ${b.fails} of ${b.measured} measured readings (${pct(b.failShare!)}); highest ${fmt(b.extreme!.value as number)} mg/L (${describeReading(b.extreme!)}).`
          : `BOD stayed at or below 3 mg/L in all ${b.measured} measured readings.`,
        readingIds: b.fails ? b.failingIds : [],
      });
    }
    if (ph.fails) {
      const vals = rows.filter((r) => ph.failingIds.includes(r.id)).map((r) => `${fmt(r.value as number)} (${r.festival} ${r.year}, ${r.phase})`);
      reasons.push({ kind: "concern", text: `pH outside 6.5–8.5 in ${ph.fails} of ${ph.measured} readings: ${vals.join("; ")}.`, readingIds: ph.failingIds });
    }

    const notSampled = d.notSampled + b.notSampled + ph.notSampled;
    if (notSampled) {
      reasons.push({ kind: "data", text: `${notSampled} DO/BOD/pH ${notSampled === 1 ? "cell was" : "cells were"} printed blank, “_” or “*” in the report: not sampled, and not counted as clean.`, readingIds: rows.filter((r) => SCREENED_PARAMETERS.includes(r.parameterId) && r.status === "not-sampled").map((r) => r.id) });
    }
    if (missingEvents.length) {
      reasons.push({ kind: "data", text: `No table for this site in the report for ${missingEvents.map(eventLabel).join(", ")}.`, readingIds: [] });
    }
    if (category === "monitor") {
      reasons.push({ kind: "caveat", text: "No recurring benchmark failure in the readings available. This does not show the water is safe: only pH, DO and BOD have Class B limits, and the readings are historical.", readingIds: [] });
    }

    // ---- Evidence strength, reported separately from concern ----
    const expectedCore = SCREENED_PARAMETERS.length * expectedPerParam;
    const measuredCore = d.measured + b.measured + ph.measured;
    const coverage = expectedCore ? measuredCore / expectedCore : 0;
    const matchConfidence = info.matchConfidence;
    const unverified = rows.filter((r) => r.verification === "unverified").length;
    const evidenceNotes: string[] = [`${measuredCore} of ${expectedCore} expected DO/BOD/pH readings are measured values (${pct(coverage)}).`];
    let evidence: EvidenceLevel = coverage >= RULES.strongCoverage ? "strong" : coverage >= RULES.moderateCoverage ? "moderate" : "limited";
    if (matchConfidence === "medium") {
      evidenceNotes.push("Site match confidence is medium: the reports may describe two different places under this name.");
      if (evidence === "strong") evidence = "moderate";
    }
    if (unverified) {
      evidenceNotes.push(`${unverified} readings have not been checked against the PDF.`);
      if (evidence === "strong") evidence = "moderate";
    }

    out.push({
      siteId,
      site: info.site,
      waterBodies: rows.length ? [...new Set(rows.map((r) => r.waterBody))] : info.waterBodies,
      matchConfidence,
      sitesAsPrinted: rows.length ? [...new Set(rows.map((r) => r.siteAsPrinted))] : info.sitesAsPrinted,
      category,
      rank: 0,
      reasons,
      stats,
      coverage,
      missingEvents,
      evidence,
      evidenceNotes,
      unverified,
      readingIds: rows.map((r) => r.id),
    });
  }

  // Transparent ordering: category, then DO shortfall share, lowest DO, BOD exceedance share, name.
  out.sort((a, z) =>
    CATEGORY_META[a.category].order - CATEGORY_META[z.category].order ||
    (z.stats.do.failShare ?? -1) - (a.stats.do.failShare ?? -1) ||
    ((a.stats.do.extreme?.value ?? Infinity) - (z.stats.do.extreme?.value ?? Infinity)) ||
    (z.stats.bod.failShare ?? -1) - (a.stats.bod.failShare ?? -1) ||
    a.site.localeCompare(z.site),
  );
  out.forEach((s, i) => (s.rank = i + 1));
  return out;
}

export const RANKING_ORDER_TEXT =
  "Within a category, sites are ordered by the share of DO readings below 5 mg/L, then by the lowest DO reading, then by the share of BOD readings above 3 mg/L.";

export interface Overview {
  sites: number;
  firstYear: number;
  lastYear: number;
  records: number;
  measured: number;
  belowDetection: number;
  notSampled: number;
  doShortfall: { fails: number; measured: number };
  bodExceedance: { fails: number; measured: number };
}

/**
 * @param view   readings after every filter (records, measured, BDL, not-sampled counts)
 * @param scoped readings after the screening scope only (DO/BOD counts), so a parameter or
 *               search filter cannot turn them into a misleading "0 of 0"
 */
export function overview(all: Reading[], view: Reading[], scoped: Reading[] = view): Overview {
  const years = all.map((r) => r.year);
  const count = (id: ParameterId) => {
    const m = scoped.filter((r) => r.parameterId === id && r.status === "measured");
    return { fails: m.filter((r) => failsClassB(id, r.value) === true).length, measured: m.length };
  };
  return {
    sites: new Set(all.map((r) => r.siteId)).size,
    firstYear: Math.min(...years),
    lastYear: Math.max(...years),
    records: view.length,
    measured: view.filter((r) => r.status === "measured").length,
    belowDetection: view.filter((r) => r.status === "below-detection").length,
    notSampled: view.filter((r) => r.status === "not-sampled").length,
    doShortfall: count("do"),
    bodExceedance: count("bod"),
  };
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface PhaseSummary { phase: Phase; measured: number; median: number | null; fails: number; notMeasured: number }

export function phaseSummary(readings: Reading[], id: ParameterId): PhaseSummary[] {
  return PHASES.map((phase) => {
    const own = readings.filter((r) => r.parameterId === id && r.phase === phase);
    const vals = own.filter((r) => r.status === "measured").map((r) => r.value as number);
    return { phase, measured: vals.length, median: median(vals), fails: own.filter((r) => failsClassB(id, r.value) === true).length, notMeasured: own.length - vals.length };
  });
}

export function benchmarkLabel(id: ParameterId): string | null {
  return parameterById(id).classB?.label ?? null;
}
