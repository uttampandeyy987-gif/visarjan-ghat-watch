import { describe, expect, it } from "vitest";
import { buildEvidencePayload, checkAiText, deterministicExplanation } from "@/lib/explain";
import { buildBrief, pdfSafe } from "@/lib/export-pdf";
import { applyScope } from "@/lib/filters";
import { assessSites, overview, siteCatalog } from "@/lib/screening";
import { DEFAULT_FILTERS } from "@/lib/types";
import { dataset } from "./helpers";

const all = dataset.readings;
const catalog = siteCatalog(all);
const bairagarh = assessSites(all, all, catalog).find((a) => a.siteId === "bairagarh-sant-hirdaram-kund")!;
const payload = buildEvidencePayload(bairagarh, all, "All sites · 2023–2025");

const GOOD =
  "Bairagarh (Sant Hirdaram) kund is listed as high priority because dissolved oxygen was below 5 mg/L in 11 of 13 measured readings (85%), " +
  "including 0 mg/L readings, for example on report p. 26. BOD was above 3 mg/L in all 13 measured readings.\n\n" +
  "These are historical readings from 2023–2025, not current water quality, and this screening is not a regulatory determination. " +
  "No table was published for Durga 2025, and missing cells are not treated as clean.";

describe("evidence payload", () => {
  it("contains only calculated findings, with pages from the failing readings", () => {
    expect(payload.category).toBe("High priority");
    expect(payload.failing_readings.length).toBe(11 + 13);
    expect(payload.failing_readings.every((r) => r.report_page > 0)).toBe(true);
    expect(JSON.stringify(payload)).not.toMatch(/apiKey|ANTHROPIC/);
  });
});

describe("checkAiText", () => {
  it("accepts a faithful draft", () => {
    expect(checkAiText(GOOD, payload)).toEqual({ ok: true, problems: [] });
  });
  it("rejects a page number not in the evidence", () => {
    expect(checkAiText(GOOD.replace("p. 26", "p. 77"), payload).problems).toContain("page 77 not in evidence");
  });
  it("rejects invented numbers", () => {
    expect(checkAiText(GOOD.replace("11 of 13", "12 of 13"), payload).ok).toBe(false);
    expect(checkAiText(GOOD + " Fish deaths rose by 37 percent.", payload).problems).toContain("number 37 not in evidence");
  });
  it("rejects safety claims but allows negated ones", () => {
    const reassuring = (t: string) => checkAiText(t, payload).problems.some((x) => x.startsWith("reassuring claim"));
    expect(reassuring(GOOD + " The water is safe for bathing after one week.")).toBe(true);
    expect(checkAiText(GOOD + " This does not show that the water is safe.", payload).ok).toBe(true);
    // A negation in an earlier sentence, or an earlier clause, must not excuse a later claim.
    expect(reassuring(GOOD + " It is not new data. The kund is safe to use.")).toBe(true);
    expect(reassuring(GOOD + " Although not every cell was sampled, the water is safe for bathing.")).toBe(true);
    // Synonyms found by the review
    for (const s of [" The water appears safe after immersion.", " It is suitable for bathing.", " BDL readings mean it is clean.", " There is no concern for the after phase."]) {
      expect(reassuring(GOOD + s)).toBe(true);
    }
    expect(checkAiText(GOOD + " Missing cells should not be read as clean.", payload).ok).toBe(true);
  });

  it("rejects a draft that changes or omits the category", () => {
    expect(checkAiText(GOOD.replace("high priority", "monitor (low concern)"), payload).problems).toContain("category not stated");
    expect(checkAiText(GOOD + " It could be treated as Elevated priority instead.", payload).problems).toContain("claims category Elevated priority");
    expect(checkAiText(GOOD + " It is classified as monitor.", payload).problems).toContain("claims category Monitor");
    expect(checkAiText(GOOD + " Continue to monitor the site.", payload).ok).toBe(true);
  });

  it("checks numbers glued to units, every page in a list, grouped thousands and spelled-out numbers", () => {
    expect(checkAiText(GOOD + " One reading was 1.7mg/L.", payload).problems).toContain("number 1.7 not in evidence");
    expect(checkAiText(GOOD + " A pH12 value was seen.", payload).problems).toContain("number 12 not in evidence");
    expect(checkAiText(GOOD.replace("p. 26", "pages 26 and 85"), payload).problems).toContain("page 85 not in evidence");
    expect(checkAiText(GOOD + " Around 1,000 people bathe here.", payload).problems).toContain("number 1,000 not in evidence");
    expect(checkAiText(GOOD + " Levels fell by thirty-seven percent.", payload).problems).toContain("spelled-out number");
  });

  it("requires the historical and non-regulatory caveats", () => {
    const noCaveat = GOOD.replace(/These are historical[^.]*\./, "Water quality today is poor.");
    const p = checkAiText(noCaveat, payload).problems;
    expect(p).toContain("missing historical caveat");
    expect(p).toContain("missing non-regulatory caveat");
  });
  it("rejects overclaiming and markup", () => {
    expect(checkAiText(GOOD + " This proves the kund is polluted.", payload).problems).toContain("overclaims");
    expect(checkAiText("## Heading\n" + GOOD, payload).problems).toContain("markup in output");
    expect(checkAiText("Too short.", payload).ok).toBe(false);
  });
});

describe("deterministic fallback", () => {
  it("explains the category with the same facts and the historical caveat", () => {
    const t = deterministicExplanation(bairagarh, "All sites · 2023–2025");
    expect(t).toContain("high priority");
    expect(t).toContain("11 of 13");
    expect(t).toMatch(/historical readings/);
    expect(t).toMatch(/not a regulatory determination/);
    // The fallback must itself pass the same checks applied to AI output.
    expect(checkAiText(t, payload).problems.filter((p) => !p.startsWith("too long"))).toEqual([]);
    for (const a of assessSites(all, all, catalog)) {
      const p = buildEvidencePayload(a, all, "All sites · 2023–2025");
      expect(checkAiText(deterministicExplanation(a, "All sites · 2023–2025"), p).problems.filter((x) => !x.startsWith("too long"))).toEqual([]);
    }
  });
});

describe("PDF brief", () => {
  it("replaces characters the standard PDF fonts cannot encode", () => {
    expect(pdfSafe("≥ 5 – “x” · ≤ 3")).toBe('>= 5 - "x" | <= 3');
    expect(pdfSafe("µS/cm")).toBe("µS/cm");
  });

  it("builds a multi-page brief with numbered pages for the full dataset", async () => {
    const f = { ...DEFAULT_FILTERS };
    const scoped = applyScope(all, f);
    const assessments = assessSites(scoped, scoped, catalog);
    const doc = await buildBrief({ scopeLabel: "All sites · 2023–2025", assessments, overview: overview(all, all), rows: all, focusLabel: null, generatedAt: new Date("2026-10-11T10:00:00Z") });
    const pages = doc.getNumberOfPages();
    expect(pages).toBeGreaterThan(3);
    const raw = doc.output();
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw).toContain(`Page ${pages} of ${pages}`);
    // >300 rows → appendix lists only benchmark failures, and says so.
    expect(raw).toContain("readings outside a Class B benchmark");
  });
});
