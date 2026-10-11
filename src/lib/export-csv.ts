import { checkLabel, displayUnit } from "./format";
import { pageUrl, REPORTS } from "./sources";
import type { Reading } from "./types";

export const CSV_COLUMNS = [
  "reading_id", "year", "festival", "site", "water_body", "phase", "parameter", "value", "value_status", "flag",
  "unit_assumed", "value_as_printed", "parameter_as_printed", "site_as_printed", "site_match_confidence",
  "class_b_check", "source_report", "source_page", "source_url", "page_check",
] as const;

/**
 * RFC 4180 quoting, plus protection against spreadsheet formula injection:
 * text cells starting with = + - @ tab or CR are prefixed with an apostrophe.
 * Plain numbers (including negatives) are left as numbers.
 */
export function csvCell(v: string | number | null): string {
  if (v === null) return "";
  let s = String(v);
  if (typeof v === "string" && /^[\s ]*[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  // Also quote ";" so semicolon-delimited spreadsheet locales keep the cell intact.
  return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One header row, one row per reading — no comment lines, so any CSV parser can read it. */
export function readingsToCsv(readings: Reading[]): string {
  const lines: string[] = [CSV_COLUMNS.join(",")];
  for (const r of readings) {
    lines.push([
      r.id, r.year, r.festival, r.site, r.waterBody, r.phase, r.parameter, r.value, r.status, r.flag,
      r.unitAssumed ? displayUnit(r) : r.parameterId === "ph" ? "" : null, r.valueAsPrinted, r.parameterAsPrinted, r.siteAsPrinted,
      r.siteMatchConfidence, checkLabel(r), REPORTS[r.sourceId].title, r.sourcePage, pageUrl(r.sourceId, r.sourcePage), r.verification,
    ].map((c) => csvCell(c as string | number | null)).join(","));
  }
  // BOM so Excel opens µ and – correctly; CRLF per RFC 4180.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
