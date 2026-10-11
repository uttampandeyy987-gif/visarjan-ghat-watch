import { describe, expect, it } from "vitest";
import { parseDataset } from "@/lib/dataset";
import { failsClassB } from "@/lib/parameters";
import { CSV, dataset, HEADER, NO_VERIFICATION, VERIFICATION } from "./helpers";

const row = (v: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    year: "2024", festival: "Ganesh", site: "Test ghat", water_body: "Test Lake", phase: "pre", parameter: "Dissolved oxygen",
    value: "4.2", unit_assumed: "mg/l", flag: "", value_as_printed: "4.2", parameter_as_printed: "D.Oxygen",
    site_as_printed: "Test ghat, Bhopal", site_match_confidence: "high", source_page: "12",
  };
  const m = { ...base, ...v };
  return HEADER.split(",").map((k) => { const v = m[k] ?? ""; return v.includes(",") ? `"${v}"` : v; }).join(",");
};
const parseRows = (...rows: string[]) => parseDataset([HEADER, ...rows].join("\n"), NO_VERIFICATION);

describe("bundled dataset", () => {
  it("loads every row without validation issues", () => {
    expect(dataset.issues).toEqual([]);
    expect(dataset.rowsRead).toBe(1524);
    expect(dataset.readings).toHaveLength(1524);
  });

  it("covers 7 sites, 2023–2025, two festivals, three phases", () => {
    const r = dataset.readings;
    expect(new Set(r.map((x) => x.siteId)).size).toBe(7);
    expect([...new Set(r.map((x) => x.year))].sort()).toEqual([2023, 2024, 2025]);
    expect(new Set(r.map((x) => x.festival))).toEqual(new Set(["Ganesh", "Durga"]));
    expect(new Set(r.map((x) => x.phase))).toEqual(new Set(["pre", "during", "after"]));
  });

  it("never turns BDL into zero", () => {
    const bdl = dataset.readings.filter((r) => r.flag === "BDL");
    expect(bdl).toHaveLength(174);
    for (const r of bdl) {
      expect(r.value).toBeNull();
      expect(r.status).toBe("below-detection");
      expect(r.valueAsPrinted).toBe("BDL");
    }
  });

  it("treats blank, _, * and ** as not sampled — never as a value", () => {
    const missing = dataset.readings.filter((r) => r.flag === "not sampled" || r.flag === "*" || r.flag === "**");
    expect(missing).toHaveLength(61);
    for (const r of missing) {
      expect(r.value).toBeNull();
      expect(r.status).toBe("not-sampled");
      expect(failsClassB(r.parameterId, r.value)).toBeNull();
    }
  });

  it("keeps a genuine 0 mg/L DO reading as a measured zero", () => {
    const zeros = dataset.readings.filter((r) => r.parameterId === "do" && r.value === 0);
    expect(zeros).toHaveLength(4);
    expect(zeros.every((r) => r.status === "measured" && r.site.startsWith("Bairagarh"))).toBe(true);
  });

  it("reproduces the PROBLEM.md headline counts", () => {
    const m = (id: string) => dataset.readings.filter((r) => r.parameterId === id && r.status === "measured");
    expect(m("do")).toHaveLength(116);
    expect(m("do").filter((r) => (r.value as number) < 5)).toHaveLength(42);
    expect(m("bod")).toHaveLength(112);
    expect(m("bod").filter((r) => (r.value as number) > 3)).toHaveLength(100);
  });

  it("marks units as assumed and preserves printed labels", () => {
    const r = dataset.readings.find((x) => x.id === "2023-ganesh-khatlapura-ghat-pre-do")!;
    expect(r).toMatchObject({ value: 6.4, unitAssumed: "mg/l", parameterAsPrinted: "D.Oxygen", siteAsPrinted: "Khatlapura Visarjanghat, Bhopal", sourcePage: 26, sourceId: "mppcb-visarjan-2023" });
    expect(dataset.readings.find((x) => x.parameterId === "ph")!.unitAssumed).toBeNull();
  });

  it("preserves the medium-confidence site match", () => {
    const rk = dataset.readings.filter((r) => r.siteId === "rani-kamlapati-ghat-kamla-park-kund");
    expect(rk).toHaveLength(228);
    expect(rk.every((r) => r.siteMatchConfidence === "medium")).toBe(true);
    expect(new Set(rk.map((r) => r.waterBody))).toEqual(new Set(["Lower Lake (as printed in Durga tables)"]));
    // Ganesh tables print "Kamla Park ... kund", Durga tables "Rani Kamlapati ... ghat (lower lake)".
    expect(rk.filter((r) => r.festival === "Ganesh").every((r) => /kamla park/i.test(r.siteAsPrinted))).toBe(true);
    expect(rk.filter((r) => r.festival === "Durga").every((r) => /lower lake/i.test(r.siteAsPrinted))).toBe(true);
  });

  it("links every reading to its table's verification status", () => {
    expect(dataset.readings.every((r) => r.verification === "auto-checked")).toBe(true);
    const unchecked = parseDataset(CSV, NO_VERIFICATION);
    expect(unchecked.readings.every((r) => r.verification === "unverified")).toBe(true);
    // A wrong page number must not inherit a verification result.
    const wrongPage = parseDataset(CSV.replace(/high,26(\r?\n)/, "high,99$1"), VERIFICATION);
    expect(wrongPage.readings.filter((r) => r.verification === "unverified")).toHaveLength(1);
  });
});

describe("validation", () => {
  it("accepts a well-formed row and strips a UTF-8 BOM", () => {
    const d = parseDataset("﻿" + [HEADER, row()].join("\n"), NO_VERIFICATION);
    expect(d.issues).toEqual([]);
    expect(d.readings[0].year).toBe(2024);
  });

  it("rejects a missing column set", () => {
    const d = parseDataset("year,site\n2024,x", NO_VERIFICATION);
    expect(d.readings).toEqual([]);
    expect(d.issues[0].message).toMatch(/Missing columns/);
  });

  it.each([
    ["value and flag together", row({ flag: "BDL" })],
    ["neither value nor flag", row({ value: "", value_as_printed: "" })],
    ["value differs from printed", row({ value_as_printed: "4.7" })],
    ["non-numeric value", row({ value: "abc", value_as_printed: "abc" })],
    ["unknown parameter", row({ parameter: "Mercury" })],
    ["year out of range", row({ year: "2019" })],
    ["unknown phase", row({ phase: "mid" })],
    ["bad page", row({ source_page: "0" })],
    ["unknown flag", row({ value: "", flag: "NIL", value_as_printed: "NIL" })],
    ["pH beyond 14", row({ parameter: "pH", parameter_as_printed: "pH", value: "15", value_as_printed: "15", unit_assumed: "" })],
  ])("rejects %s", (_name, bad) => {
    const d = parseRows(bad);
    expect(d.readings).toHaveLength(0);
    expect(d.issues).toHaveLength(1);
  });

  it("rejects duplicate readings instead of double counting", () => {
    const d = parseRows(row(), row());
    expect(d.readings).toHaveLength(1);
    expect(d.issues[0].message).toMatch(/Duplicate/);
  });

  it("handles quoted fields containing commas", () => {
    const d = parseRows(row({ site_as_printed: "Prempura ghat, Bhopal, MP" }));
    expect(d.readings[0].siteAsPrinted).toBe("Prempura ghat, Bhopal, MP");
  });
});
