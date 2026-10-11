import { describe, expect, it } from "vitest";
import { applyFilters, applyScope, describeFilters, parseFilters } from "@/lib/filters";
import { assessSites, CATEGORY_META, overview, phaseSummary, RULES, siteCatalog } from "@/lib/screening";
import { DEFAULT_FILTERS, type Filters, type Reading } from "@/lib/types";
import { dataset } from "./helpers";

const all = dataset.readings;
const catalog = siteCatalog(all);
function screen(f: Partial<Filters> = {}) {
  const filters = { ...DEFAULT_FILTERS, ...f };
  const scoped = applyScope(all, filters);
  const universe = applyScope(all, { ...filters, site: "all" });
  return assessSites(scoped, universe, filters.site === "all" ? catalog : catalog.filter((s) => s.siteId === filters.site));
}
const bySite = (list: ReturnType<typeof screen>) => Object.fromEntries(list.map((s) => [s.siteId, s]));

describe("screening over the full record", () => {
  const list = screen();
  const s = bySite(list);

  it("assesses all 7 sites", () => expect(list).toHaveLength(7));

  it("assigns categories that follow the documented rules", () => {
    expect(s["bairagarh-sant-hirdaram-kund"].category).toBe("high"); // DO < 5 in 11/13
    expect(s["malikhedi-kund"].category).toBe("high"); // 9/13
    for (const id of ["khatlapura-ghat", "prempura-ghat", "rani-kamlapati-ghat-kamla-park-kund", "hathaikheda-dam-kund", "shahpura-lake-ghat"]) {
      expect(s[id].category).toBe("elevated");
    }
  });

  it("every displayed category is re-derivable from its own stats", () => {
    for (const a of list) {
      const { do: d, bod: b, ph } = a.stats;
      const expected =
        d.measured < RULES.minMeasured || b.measured < RULES.minMeasured ? "insufficient"
        : (d.failShare ?? 0) >= RULES.highDoShortfallShare ? "high"
        : d.fails > 0 || ph.fails > 0 || (b.failShare ?? 0) >= RULES.elevatedBodShare ? "elevated"
        : ph.measured < RULES.minMeasured ? "insufficient"
        : "monitor";
      expect(a.category).toBe(expected);
      expect(a.reasons.length).toBeGreaterThan(0);
    }
  });

  it("ranks by category, then DO shortfall share", () => {
    expect(list.map((x) => x.siteId).slice(0, 2)).toEqual(["bairagarh-sant-hirdaram-kund", "malikhedi-kund"]);
    const orders = list.map((x) => CATEGORY_META[x.category].order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(list.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("reports the lowest DO with its source page", () => {
    const b = s["bairagarh-sant-hirdaram-kund"];
    expect(b.stats.do.extreme?.value).toBe(0);
    expect(b.reasons.some((r) => r.text.startsWith("Lowest DO: 0 mg/L") && r.text.includes("report p."))).toBe(true);
  });

  it("counts missing tables and not-sampled cells as gaps, not as clean readings", () => {
    const b = s["bairagarh-sant-hirdaram-kund"];
    expect(b.missingEvents).toEqual([{ year: 2025, festival: "Durga" }]);
    expect(b.stats.do).toMatchObject({ expected: 18, measured: 13, notSampled: 2, noTable: 3, fails: 11 });
    expect(b.coverage).toBeCloseTo(39 / 54);
    expect(b.evidence).toBe("moderate");
  });

  it("caps evidence strength for the medium-confidence site match", () => {
    const rk = s["rani-kamlapati-ghat-kamla-park-kund"];
    expect(rk.coverage).toBe(1);
    expect(rk.evidence).toBe("moderate");
    expect(rk.evidenceNotes.join(" ")).toMatch(/medium/);
  });

  it("Prempura 2023 Durga BOD gap is reported", () => {
    expect(s["prempura-ghat"].stats.bod.notSampled).toBe(3);
  });
});

describe("filtered screening", () => {
  it("keeps sites with no table in view, as Insufficient data", () => {
    const list = screen({ year: 2025, festival: "Durga" });
    expect(list).toHaveLength(7);
    const s = bySite(list);
    for (const id of ["bairagarh-sant-hirdaram-kund", "malikhedi-kund"]) {
      expect(s[id].category).toBe("insufficient");
      expect(s[id].stats.do.measured).toBe(0);
      expect(s[id].reasons.some((r) => r.text.includes("No table"))).toBe(true);
    }
    expect(list.slice(-2).every((x) => x.category === "insufficient")).toBe(true);
  });

  it("partial sampling (2025 Ganesh, only during) is Insufficient, not reassuring", () => {
    const s = bySite(screen({ year: 2025, festival: "Ganesh" }));
    expect(s["malikhedi-kund"].stats.do.measured).toBe(1);
    expect(s["malikhedi-kund"].category).toBe("insufficient");
  });

  it("Monitor is reachable and always carries the not-safe caveat", () => {
    const list = screen({ year: 2023, festival: "Ganesh", phase: "pre" });
    // Single phase → 1 reading per site → all insufficient
    expect(list.every((x) => x.category === "insufficient")).toBe(true);
    // Prempura 2023 Ganesh: DO and BOD within limits, but pH 8.53 during immersion → Elevated, not Monitor.
    expect(screen({ site: "prempura-ghat", year: 2023, festival: "Ganesh" })[0].category).toBe("elevated");
    const monitors = [2023, 2024, 2025].flatMap((year) => (["Ganesh", "Durga"] as const).flatMap((festival) => screen({ year, festival })))
      .filter((a) => a.category === "monitor");
    expect(monitors.length).toBeGreaterThan(0);
    for (const m of monitors) {
      expect(m.stats.do.fails + m.stats.ph.fails).toBe(0);
      expect(m.reasons.some((r) => r.kind === "caveat" && /does not show the water is safe/.test(r.text))).toBe(true);
    }
  });

  it("site filter narrows the ranking to that site", () => {
    const list = screen({ site: "khatlapura-ghat" });
    expect(list.map((x) => x.siteId)).toEqual(["khatlapura-ghat"]);
  });

  it("every reason's reading ids exist and belong to the site", () => {
    const ids = new Map(all.map((r) => [r.id, r] as const));
    for (const a of screen()) for (const reason of a.reasons) for (const id of reason.readingIds) {
      expect(ids.get(id)?.siteId).toBe(a.siteId);
    }
  });
});

describe("edge cases found in review", () => {
  const base = all.find((r) => r.id === "2023-ganesh-prempura-ghat-pre-do")!;
  const make = (over: Partial<Reading>): Reading => ({ ...base, ...over, id: `${over.year ?? base.year}-x-${over.phase}-${over.parameterId}` });
  const info = [{ siteId: "prempura-ghat", site: "Prempura ghat", waterBodies: ["Upper Lake"], matchConfidence: "high" as const, sitesAsPrinted: [] }];

  it("counts a below-detection DO reading as below the 5 mg/L minimum", () => {
    const rows = (["pre", "during", "after"] as const).flatMap((phase) => [
      make({ phase, parameterId: "do", parameter: "Dissolved oxygen", value: null, status: "below-detection", flag: "BDL", valueAsPrinted: "BDL" }),
      make({ phase, parameterId: "bod", parameter: "BOD", value: 2, status: "measured" }),
      make({ phase, parameterId: "ph", parameter: "pH", value: 7.5, status: "measured" }),
    ]);
    const [a] = assessSites(rows, rows, info);
    expect(a.stats.do).toMatchObject({ measured: 3, fails: 3, belowDetection: 0 });
    expect(a.category).toBe("high");
  });

  it("does not list a site as Monitor without enough pH readings", () => {
    const rows = (["pre", "during", "after"] as const).flatMap((phase) => [
      make({ phase, parameterId: "do", parameter: "Dissolved oxygen", value: 7, status: "measured" }),
      make({ phase, parameterId: "bod", parameter: "BOD", value: 2, status: "measured" }),
      make({ phase, parameterId: "ph", parameter: "pH", value: null, status: "not-sampled", flag: "not sampled", valueAsPrinted: "" }),
    ]);
    const [a] = assessSites(rows, rows, info);
    expect(a.category).toBe("insufficient");
    expect(a.reasons[0].text).toMatch(/only 0 measured pH readings/);
  });

  it("describes parameter and search filters in the scope label, and keeps DO/BOD counts on the screening scope", () => {
    const f: Filters = { ...DEFAULT_FILTERS, parameter: "bod", q: "Khatlapura" };
    expect(describeFilters(f, (id) => id)).toBe("All sites · 2023–2025 · Ganesh and Durga · all phases · parameter: BOD · search: “Khatlapura”");
    const o = overview(all, applyFilters(all, f), applyScope(all, f));
    expect(o.doShortfall).toEqual({ fails: 42, measured: 116 });
    expect(o.records).toBe(18);
  });
});

describe("filters and overview", () => {
  it("applies every filter consistently", () => {
    const f: Filters = { ...DEFAULT_FILTERS, year: 2024, festival: "Durga", phase: "after", parameter: "bod" };
    const v = applyFilters(all, f);
    expect(v).toHaveLength(7);
    expect(v.every((r: Reading) => r.year === 2024 && r.festival === "Durga" && r.phase === "after" && r.parameterId === "bod")).toBe(true);
  });

  it("searches site and parameter labels, case-insensitively, including printed labels", () => {
    expect(applyFilters(all, { ...DEFAULT_FILTERS, q: "hirdaram" }).every((r) => r.siteId === "bairagarh-sant-hirdaram-kund")).toBe(true);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, q: "D.OXYGEN" })).toHaveLength(120);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, q: "zzz" })).toHaveLength(0);
  });

  it("parses untrusted query parameters, dropping unknown values", () => {
    const known = { siteIds: new Set(all.map((r) => r.siteId)), years: new Set([2023, 2024, 2025]) };
    expect(parseFilters({ site: "../../etc/passwd", year: "1999", festival: "Diwali", phase: "<script>", parameter: "mercury", q: "x".repeat(500) }, known))
      .toEqual({ ...DEFAULT_FILTERS, q: "x".repeat(80) });
    expect(parseFilters({ site: "prempura-ghat", year: "2024", festival: "Durga", phase: "after", parameter: "bod" }, known))
      .toMatchObject({ site: "prempura-ghat", year: 2024, festival: "Durga", phase: "after", parameter: "bod" });
  });

  it("overview counts are computed from the view", () => {
    const o = overview(all, all);
    expect(o).toMatchObject({ sites: 7, firstYear: 2023, lastYear: 2025, records: 1524, measured: 1289, belowDetection: 174, notSampled: 61 });
    expect(o.doShortfall).toEqual({ fails: 42, measured: 116 });
    expect(o.bodExceedance).toEqual({ fails: 100, measured: 112 });
  });

  it("phase summary leaves unmeasured cells out of the median", () => {
    const s = phaseSummary(all, "do");
    expect(s.map((x) => x.measured)).toEqual([38, 40, 38]);
    expect(s.reduce((n, x) => n + x.measured + x.notMeasured, 0)).toBe(120);
  });
});
