import { failsClassB, parameterById } from "./parameters";
import { REPORTS } from "./sources";
import type { Phase, Reading } from "./types";

export function fmtNum(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString("en-IN");
  return String(Number(v.toPrecision(6)));
}

export const PHASE_SHORT: Record<Phase, string> = { pre: "Before", during: "During", after: "After" };
export const PHASE_LONG: Record<Phase, string> = { pre: "Before immersion", during: "During immersion", after: "One week after" };

export function displayUnit(r: Reading): string {
  if (!r.unitAssumed) return r.parameterId === "ph" ? "pH units" : "—";
  return r.unitAssumed.replace(/^mg\/l$/i, "mg/L");
}

export type CheckResult = "fails" | "within" | "no-limit" | "no-value";

export function classBCheck(r: Reading): CheckResult {
  if (!parameterById(r.parameterId).classB) return "no-limit";
  const f = failsClassB(r.parameterId, r.value);
  if (f === null) return "no-value";
  return f ? "fails" : "within";
}

export function checkLabel(r: Reading): string {
  const c = classBCheck(r);
  const b = parameterById(r.parameterId).classB;
  if (c === "no-limit") return "No Class B limit";
  if (c === "no-value") return r.status === "below-detection" ? "Below detection" : "Not sampled";
  if (c === "within") return `Within (${b!.label})`;
  if (b!.kind === "min") return `Below minimum (${b!.label})`;
  if (b!.kind === "max") return `Above maximum (${b!.label})`;
  return `Outside range (${b!.label})`;
}

export function valueText(r: Reading): string {
  if (r.status === "measured") return fmtNum(r.value as number);
  if (r.status === "below-detection") return r.flag === "ND" ? "Not detected" : "Below detection";
  return "Not sampled";
}

export function reportLabel(r: Reading): string {
  return `MPPCB ${REPORTS[r.sourceId].year} report, p. ${r.sourcePage}`;
}

/** Drik Panchang: Durga Visarjan, Tuesday 20 October 2026. */
export const DURGA_VISARJAN_2026 = "2026-10-20";

/** Days from `today` to `target`, both read as calendar dates in Asia/Kolkata. */
export function daysUntil(target: string, now: Date): number {
  const ist = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${ist}T00:00:00Z`)) / 86_400_000);
}
