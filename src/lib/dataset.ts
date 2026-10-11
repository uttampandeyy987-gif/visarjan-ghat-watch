import Papa from "papaparse";
import { z } from "zod";
import { parameterByName } from "./parameters";
import { reportForYear } from "./sources";
import { FESTIVALS, FLAGS, PHASES, type Dataset, type DatasetIssue, type Flag, type Reading, type ValueStatus, type VerificationStatus } from "./types";

const EXPECTED_COLUMNS = [
  "year", "festival", "site", "water_body", "phase", "parameter", "value", "unit_assumed", "flag",
  "value_as_printed", "parameter_as_printed", "site_as_printed", "site_match_confidence", "source_page",
] as const;

const RowSchema = z.object({
  year: z.string().regex(/^20(2[3-5])$/, "year must be 2023–2025"),
  festival: z.enum(FESTIVALS),
  site: z.string().min(1).max(120),
  water_body: z.string().min(1).max(120),
  phase: z.enum(PHASES),
  parameter: z.string().min(1).max(60),
  value: z.string().max(20),
  unit_assumed: z.string().max(20),
  flag: z.union([z.literal(""), z.enum(FLAGS)]),
  value_as_printed: z.string().max(40),
  parameter_as_printed: z.string().min(1).max(80),
  site_as_printed: z.string().min(1).max(200),
  site_match_confidence: z.enum(["high", "medium"]),
  source_page: z.string().regex(/^[1-9]\d{0,3}$/, "source_page must be a page number"),
});

export interface VerificationFile {
  method: string;
  checkedOn: string;
  tables: { year: number; festival: string; site: string; page: number; status: VerificationStatus }[];
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function statusFor(flag: Flag | null): ValueStatus {
  if (flag === null) return "measured";
  return flag === "BDL" || flag === "ND" ? "below-detection" : "not-sampled";
}

/** Parses and validates the hackathon CSV. Invalid rows are excluded and reported, never repaired by guesswork. */
export function parseDataset(csvText: string, verification: VerificationFile): Dataset {
  const text = csvText.replace(/^﻿/, "");
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const issues: DatasetIssue[] = parsed.errors.map((e) => ({ row: (e.row ?? -1) + 2, message: `CSV: ${e.message}` }));

  const fields = parsed.meta.fields ?? [];
  const missingCols = EXPECTED_COLUMNS.filter((c) => !fields.includes(c));
  if (missingCols.length) {
    return { readings: [], issues: [...issues, { row: 1, message: `Missing columns: ${missingCols.join(", ")}` }], rowsRead: 0, verificationMethod: verification.method, verificationCheckedOn: verification.checkedOn };
  }

  const verified = new Map(verification.tables.map((t) => [`${t.year}|${t.festival}|${t.site}|${t.page}`, t.status]));
  const seen = new Set<string>();
  const readings: Reading[] = [];

  parsed.data.forEach((raw, i) => {
    const rowNo = i + 2; // header is row 1
    const res = RowSchema.safeParse(raw);
    if (!res.success) {
      issues.push({ row: rowNo, message: res.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
      return;
    }
    const r = res.data;
    const param = parameterByName(r.parameter);
    if (!param) { issues.push({ row: rowNo, message: `Unknown parameter "${r.parameter}"` }); return; }

    const flag: Flag | null = r.flag === "" ? null : r.flag;
    let value: number | null = null;
    if (r.value.trim() !== "") {
      value = Number(r.value);
      if (!Number.isFinite(value)) { issues.push({ row: rowNo, message: `Non-numeric value "${r.value}"` }); return; }
    }
    // A row must be either a number or a flag explaining its absence — never both, never neither.
    if ((value === null) === (flag === null)) {
      issues.push({ row: rowNo, message: `Value/flag mismatch (value "${r.value}", flag "${r.flag}")` });
      return;
    }
    if (value !== null && Number(r.value_as_printed) !== value) {
      issues.push({ row: rowNo, message: `Value ${value} differs from printed "${r.value_as_printed}"` });
      return;
    }
    if (param.classB?.kind === "range" && value !== null && (value < 0 || value > 14)) {
      issues.push({ row: rowNo, message: `pH ${value} outside 0–14` });
      return;
    }
    if (value !== null && value < 0) { issues.push({ row: rowNo, message: `Negative value ${value}` }); return; }

    const year = Number(r.year);
    const siteId = slugify(r.site);
    const id = `${year}-${r.festival.toLowerCase()}-${siteId}-${r.phase}-${param.id}`;
    if (seen.has(id)) { issues.push({ row: rowNo, message: `Duplicate reading ${id}` }); return; }
    seen.add(id);

    const page = Number(r.source_page);
    readings.push({
      id,
      year,
      festival: r.festival,
      siteId,
      site: r.site,
      waterBody: r.water_body,
      phase: r.phase,
      parameterId: param.id,
      parameter: param.name,
      value,
      status: statusFor(flag),
      flag,
      unitAssumed: r.unit_assumed.trim() === "" ? null : r.unit_assumed.trim(),
      valueAsPrinted: r.value_as_printed,
      parameterAsPrinted: r.parameter_as_printed,
      siteAsPrinted: r.site_as_printed,
      siteMatchConfidence: r.site_match_confidence,
      sourceId: reportForYear(year),
      sourcePage: page,
      verification: verified.get(`${year}|${r.festival}|${r.site}|${page}`) ?? "unverified",
    });
  });

  return { readings, issues, rowsRead: parsed.data.length, verificationMethod: verification.method, verificationCheckedOn: verification.checkedOn };
}
