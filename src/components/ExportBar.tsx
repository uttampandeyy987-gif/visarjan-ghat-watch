"use client";

import { useState } from "react";
import { readingsToCsv } from "@/lib/export-csv";
import { filtersToSearch } from "@/lib/filters";
import type { Overview, SiteAssessment } from "@/lib/screening";
import type { Filters, Reading } from "@/lib/types";
import styles from "./ExportBar.module.css";

interface Props {
  rows: Reading[];
  focusLabel: string | null;
  filters: Filters;
  scopeLabel: string;
  assessments: SiteAssessment[];
  overview: Overview;
}

function fileStem(f: Filters, focused: boolean): string {
  const q = filtersToSearch(f).slice(1).replace(/[^a-z0-9=&-]/gi, "").replace(/[=&]/g, "-");
  return `ghat-watch_${q || "all"}${focused ? "_focus" : ""}`.slice(0, 120);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportBar({ rows, focusLabel, filters, scopeLabel, assessments, overview }: Props) {
  const [pdfState, setPdfState] = useState<"idle" | "busy" | "error">("idle");
  const [csvDone, setCsvDone] = useState(false);

  const csv = () => {
    download(new Blob([readingsToCsv(rows)], { type: "text/csv;charset=utf-8" }), `${fileStem(filters, !!focusLabel)}.csv`);
    setCsvDone(true);
    setTimeout(() => setCsvDone(false), 2500);
  };

  const pdf = async () => {
    setPdfState("busy");
    try {
      const { buildBrief } = await import("@/lib/export-pdf");
      const doc = await buildBrief({ scopeLabel, assessments, overview, rows, focusLabel, generatedAt: new Date() });
      download(doc.output("blob"), `${fileStem(filters, !!focusLabel)}_brief.pdf`);
      setPdfState("idle");
    } catch (e) {
      console.error("PDF generation failed", e instanceof Error ? e.message : e);
      setPdfState("error");
    }
  };

  return (
    <div className={styles.bar}>
      <p className={styles.what}>
        <strong>{rows.length.toLocaleString("en-IN")}</strong> readings in the current {focusLabel ? "evidence focus" : "view"} · {scopeLabel}
      </p>
      <div className={styles.actions}>
        <button type="button" onClick={csv} disabled={rows.length === 0} className={styles.secondary}>
          {csvDone ? "CSV downloaded" : "Download evidence CSV"}
        </button>
        <button type="button" onClick={pdf} disabled={pdfState === "busy" || assessments.length === 0} className={styles.primary} aria-busy={pdfState === "busy"}>
          {pdfState === "busy" ? "Building brief…" : "Download PDF brief"}
        </button>
      </div>
      {pdfState === "error" && <p className={styles.error} role="alert">The PDF could not be built in this browser. The CSV export still works.</p>}
    </div>
  );
}
