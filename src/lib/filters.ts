import { isParameterId, parameterById } from "./parameters";
import { DEFAULT_FILTERS, FESTIVALS, PHASES, type Festival, type Filters, type Phase, type Reading } from "./types";

export const MAX_QUERY_LENGTH = 80;

/** Screening scope: site, year, festival, phase. Parameter and search narrow the evidence, not the screening. */
export function applyScope(readings: Reading[], f: Filters): Reading[] {
  return readings.filter((r) =>
    (f.site === "all" || r.siteId === f.site) &&
    (f.year === "all" || r.year === f.year) &&
    (f.festival === "all" || r.festival === f.festival) &&
    (f.phase === "all" || r.phase === f.phase),
  );
}

export function matchesQuery(r: Reading, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [r.site, r.siteAsPrinted, r.waterBody, r.parameter, r.parameterAsPrinted].some((s) => s.toLowerCase().includes(needle));
}

/** Everything shown in the evidence ledger and written to exports. */
export function applyFilters(readings: Reading[], f: Filters): Reading[] {
  return applyScope(readings, f).filter((r) => (f.parameter === "all" || r.parameterId === f.parameter) && matchesQuery(r, f.q));
}

/** Parses untrusted query-string values into Filters, keeping only values that exist in the dataset. */
export function parseFilters(params: Record<string, string | string[] | undefined>, known: { siteIds: Set<string>; years: Set<number> }): Filters {
  const one = (k: string) => { const v = params[k]; return (Array.isArray(v) ? v[0] : v)?.slice(0, 100); };
  const site = one("site");
  const year = Number(one("year"));
  const festival = one("festival");
  const phase = one("phase");
  const parameter = one("parameter");
  return {
    site: site && known.siteIds.has(site) ? site : DEFAULT_FILTERS.site,
    year: known.years.has(year) ? year : "all",
    festival: FESTIVALS.includes(festival as Festival) ? (festival as Festival) : "all",
    phase: PHASES.includes(phase as Phase) ? (phase as Phase) : "all",
    parameter: parameter && isParameterId(parameter) ? parameter : "all",
    q: (one("q") ?? "").slice(0, MAX_QUERY_LENGTH),
  };
}

export function filtersToSearch(f: Filters): string {
  const p = new URLSearchParams();
  if (f.site !== "all") p.set("site", f.site);
  if (f.year !== "all") p.set("year", String(f.year));
  if (f.festival !== "all") p.set("festival", f.festival);
  if (f.phase !== "all") p.set("phase", f.phase);
  if (f.parameter !== "all") p.set("parameter", f.parameter);
  if (f.q.trim()) p.set("q", f.q.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function describeFilters(f: Filters, siteName: (id: string) => string): string {
  const parts = [
    f.site === "all" ? "All sites" : siteName(f.site),
    f.year === "all" ? "2023–2025" : String(f.year),
    f.festival === "all" ? "Ganesh and Durga" : f.festival,
    f.phase === "all" ? "all phases" : `${f.phase} immersion`,
  ];
  if (f.parameter !== "all") parts.push(`parameter: ${parameterById(f.parameter).name}`);
  if (f.q.trim()) parts.push(`search: “${f.q.trim()}”`);
  return parts.join(" · ");
}
