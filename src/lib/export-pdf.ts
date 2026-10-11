import type { jsPDF as JsPDF } from "jspdf";
import { checkLabel, displayUnit, fmtNum, PHASE_SHORT, valueText } from "./format";
import { suggestedSteps } from "./recommend";
import { CATEGORY_META, RANKING_ORDER_TEXT, RULES, type Overview, type SiteAssessment } from "./screening";
import { DATASET_SOURCE, EXCLUDED_SOURCES, REPORTS, STANDARD_SOURCE } from "./sources";
import type { Reading } from "./types";

export interface BriefInput {
  scopeLabel: string;
  assessments: SiteAssessment[];
  overview: Overview;
  rows: Reading[];
  focusLabel: string | null;
  generatedAt: Date;
}

const INK: [number, number, number] = [19, 35, 33];
const INK2: [number, number, number] = [63, 76, 73];
const DEEP: [number, number, number] = [15, 61, 59];
const LINE: [number, number, number] = [205, 200, 187];
const MARGIN = 48;

/** jsPDF's standard fonts are WinAnsi: replace characters they cannot encode. */
export function pdfSafe(s: string): string {
  return s
    .replace(/[≥]/g, ">=").replace(/[≤]/g, "<=").replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, "...").replace(/·/g, "|").replace(/†/g, "+").replace(/[^\x00-\xFF]/g, "?");
}

export async function buildBrief(input: BriefInput): Promise<JsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const CW = W - MARGIN * 2;
  let y = MARGIN;

  const ensure = (need: number) => { if (y + need > H - MARGIN - 20) { doc.addPage(); y = MARGIN; } };
  const text = (s: string, size = 10, opts: { bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? INK));
    const lines = doc.splitTextToSize(pdfSafe(s), CW) as string[];
    for (const line of lines) { ensure(size * 1.35); doc.text(line, MARGIN, y); y += size * 1.35; }
    y += opts.gap ?? 4;
  };
  const heading = (s: string) => { ensure(40); y += 8; text(s, 13, { bold: true, color: DEEP, gap: 6 }); };
  const bullet = (s: string, size = 9.5) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(pdfSafe(s), CW - 12) as string[];
    lines.forEach((line, i) => { ensure(size * 1.35); if (i === 0) doc.text("-", MARGIN, y); doc.text(line, MARGIN + 12, y); y += size * 1.35; });
    y += 2;
  };

  // ---- Cover block ----
  doc.setFillColor(...DEEP); doc.rect(0, 0, W, 6, "F");
  text("GHAT WATCH  |  DECISION BRIEF", 9, { bold: true, color: INK2, gap: 12 });
  text("Bhopal immersion ghats: historical water-quality screening", 18, { bold: true, gap: 6 });
  text(`View: ${input.scopeLabel}${input.focusLabel ? `. Evidence focus: ${input.focusLabel}` : ""}`, 10, { color: INK2, gap: 2 });
  text(`Generated ${input.generatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST from the MPPCB 2023-2025 immersion reports.`, 9, { color: INK2, gap: 10 });

  doc.setDrawColor(...LINE); doc.setFillColor(245, 243, 238);
  const boxText = "These are historical readings (2023-2025), not current water quality. Screening uses CPCB Class B (organised outdoor bathing) criteria as a reference; it is not a regulatory determination and does not assess health effects. BDL (below detection) is not zero, and not-sampled cells are never counted as clean.";
  // Set the font before measuring, so line breaks match what is drawn.
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
  const boxLines = doc.splitTextToSize(pdfSafe(boxText), CW - 20) as string[];
  const boxH = boxLines.length * 12.5 + 16;
  ensure(boxH + 8);
  doc.roundedRect(MARGIN, y - 4, CW, boxH, 4, 4, "FD");
  boxLines.forEach((l, i) => doc.text(l, MARGIN + 10, y + 10 + i * 12.5));
  y += boxH + 10;

  // ---- Summary ----
  heading("Summary of the current view");
  const o = input.overview;
  bullet(`${o.sites} sites in the dataset; period ${o.firstYear}-${o.lastYear}. Records in view: ${o.records} (${o.measured} measured, ${o.belowDetection} below detection, ${o.notSampled} not sampled).`);
  bullet(`For the selected sites, years, festivals and phases: dissolved oxygen below 5 mg/L in ${o.doShortfall.fails} of ${o.doShortfall.measured} measured readings; BOD above 3 mg/L in ${o.bodExceedance.fails} of ${o.bodExceedance.measured}.`);
  const counts = (["high", "elevated", "monitor", "insufficient"] as const).map((c) => `${CATEGORY_META[c].label}: ${input.assessments.filter((a) => a.category === c).length}`);
  bullet(`Screening: ${counts.join("; ")}.`);

  // ---- Ranking table ----
  heading("Site screening (calculated)");
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["#", "Site", "Category", "DO < 5", "Lowest DO", "BOD > 3", "pH out", "Record"]],
    body: input.assessments.map((a) => [
      String(a.rank),
      pdfSafe(`${a.site}${a.matchConfidence === "medium" ? " (site match: medium)" : ""}`),
      CATEGORY_META[a.category].label,
      a.stats.do.measured ? `${a.stats.do.fails}/${a.stats.do.measured}` : "-",
      a.stats.do.extreme ? fmtNum(a.stats.do.extreme.value as number) : "-",
      a.stats.bod.measured ? `${a.stats.bod.fails}/${a.stats.bod.measured}` : "-",
      a.stats.ph.measured ? `${a.stats.ph.fails}/${a.stats.ph.measured}` : "-",
      `${Math.round(a.coverage * 100)}% measured`,
    ]),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
    headStyles: { fillColor: DEEP, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 20 }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  text(`${RANKING_ORDER_TEXT} Counts are measured readings only.`, 8.5, { color: INK2 });

  // ---- Per-site reasons ----
  heading("Why each site received its category");
  for (const a of input.assessments) {
    ensure(60);
    text(`${a.rank}. ${a.site} - ${CATEGORY_META[a.category].label}`, 10.5, { bold: true, gap: 2 });
    text(`Rule: ${CATEGORY_META[a.category].rule}`, 8.5, { color: INK2, gap: 3 });
    for (const r of a.reasons) bullet(r.text, 9);
    for (const n of a.evidenceNotes) bullet(`Record: ${n}`, 9);
    for (const s of suggestedSteps(a)) bullet(`Suggested step (rule-based): ${s}`, 9);
    y += 4;
  }

  // ---- Method ----
  heading("Method and limitations");
  bullet(`Benchmarks: CPCB Class B - pH 6.5-8.5; dissolved oxygen >= 5 mg/L; BOD <= 3 mg/L. No Class B limit exists for COD, solids, turbidity, conductivity or metals, so none is applied.`);
  bullet(`Insufficient data: fewer than ${RULES.minMeasured} measured DO or BOD readings in the view (or, for a site with no failures, fewer than ${RULES.minMeasured} pH readings). High priority: DO below 5 mg/L in at least ${RULES.highDoShortfallShare * 100}% of measured DO readings. Elevated: any DO below 5, any pH outside 6.5-8.5, or BOD above 3 in at least ${RULES.elevatedBodShare * 100}% of readings. Monitor: none of these.`);
  bullet("Units are assumed: the reports print none. Site names were standardised by the dataset authors; one site (Rani Kamlapati ghat / Kamla Park kund) may describe two places.");
  bullet("Every dataset value was compared automatically with the text layer of its cited PDF page (column-aware). This is not a human review; check the PDF before relying on a figure.");
  bullet(`Not combined: ${EXCLUDED_SOURCES.map((s) => s.title).join("; ")} - monthly lake-station data with a different sampling context.`);

  // ---- Evidence appendix ----
  const failing = input.rows.filter((r) => checkLabel(r).startsWith("Below") || checkLabel(r).startsWith("Above") || checkLabel(r).startsWith("Outside"));
  const appendix = input.rows.length <= 300 ? input.rows : failing;
  doc.addPage(); y = MARGIN;
  heading(input.rows.length <= 300 ? `Evidence: all ${input.rows.length} readings in view` : `Evidence: ${failing.length} readings outside a Class B benchmark (of ${input.rows.length} in view; full set in the CSV export)`);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 10 },
    head: [["Site", "Festival", "Phase", "Parameter", "Value", "Printed", "Unit+", "Class B", "Source"]],
    body: appendix.map((r) => [
      pdfSafe(r.site), `${r.festival} ${r.year}`, PHASE_SHORT[r.phase], pdfSafe(r.parameter), pdfSafe(valueText(r)), pdfSafe(r.valueAsPrinted || "(blank)"),
      pdfSafe(displayUnit(r)), pdfSafe(checkLabel(r)), `${REPORTS[r.sourceId].year} p.${r.sourcePage}${r.verification === "unverified" ? " (unverified)" : ""}`,
    ]),
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 3, textColor: INK, lineColor: LINE, lineWidth: 0.4, overflow: "linebreak" },
    headStyles: { fillColor: DEEP, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 92 }, 4: { halign: "right" } },
    rowPageBreak: "avoid",
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  text("+ Units assumed (the reports print none).", 8, { color: INK2 });

  heading("Sources");
  for (const s of [...Object.values(REPORTS), DATASET_SOURCE, STANDARD_SOURCE]) {
    bullet(`${s.title} - ${s.publisher}. ${s.url}`, 8.5);
  }

  // ---- Footer on every page ----
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...INK2);
    doc.text(pdfSafe(`Ghat Watch | ${input.scopeLabel} | historical screening, not a regulatory determination`), MARGIN, H - 24);
    doc.text(`Page ${i} of ${n}`, W - MARGIN, H - 24, { align: "right" });
  }
  return doc;
}
