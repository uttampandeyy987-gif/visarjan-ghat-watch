import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { csvCell, CSV_COLUMNS, readingsToCsv } from "@/lib/export-csv";
import { applyFilters } from "@/lib/filters";
import { DEFAULT_FILTERS } from "@/lib/types";
import { dataset } from "./helpers";

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Khatlapura, "Lower" lake')).toBe('"Khatlapura, ""Lower"" lake"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });
  it("neutralises spreadsheet formulas but keeps numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2.5")).toBe("-2.5");
    expect(csvCell(-2.5)).toBe("-2.5");
    expect(csvCell(" =cmd")).toBe("' =cmd");
    expect(csvCell(" @SUM(A1)")).toBe("' @SUM(A1)");
  });
  it("quotes semicolons for semicolon-delimited locales", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
  });
});

describe("readingsToCsv", () => {
  const view = applyFilters(dataset.readings, { ...DEFAULT_FILTERS, site: "rani-kamlapati-ghat-kamla-park-kund", year: 2023 });
  const csv = readingsToCsv(view);
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });

  it("round-trips through a CSV parser with exactly the filtered rows", () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta.fields).toEqual([...CSV_COLUMNS]);
    expect(parsed.data).toHaveLength(view.length);
    expect(parsed.data.map((r) => r.reading_id)).toEqual(view.map((r) => r.id));
  });

  it("keeps BDL as an empty value with its flag, never 0", () => {
    const bdl = parsed.data.filter((r) => r.flag === "BDL");
    expect(bdl.length).toBeGreaterThan(0);
    expect(bdl.every((r) => r.value === "" && r.value_as_printed === "BDL" && r.value_status === "below-detection")).toBe(true);
  });

  it("carries the source report, page, URL and check status on every row", () => {
    for (const r of parsed.data) {
      expect(r.source_url).toMatch(/^https:\/\/www\.mppcb\.mp\.gov\.in\/proc\/mon\/.+\.pdf#page=\d+$/);
      expect(r.source_page).toMatch(/^\d+$/);
      expect(["auto-checked", "unverified"]).toContain(r.page_check);
    }
    expect(parsed.data[0].site_as_printed).toContain(","); // quoted field survived
  });

  it("uses CRLF line endings and a UTF-8 BOM", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(view.length + 2);
    expect(csv).toContain("µS/cm");
  });
});
