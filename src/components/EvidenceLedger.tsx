"use client";

import { useMemo, useState } from "react";
import { checkLabel, classBCheck, displayUnit, PHASE_SHORT, valueText } from "@/lib/format";
import { pageUrl, REPORTS } from "@/lib/sources";
import type { Phase, Reading } from "@/lib/types";
import styles from "./EvidenceLedger.module.css";

export interface EvidenceFocus { ids: string[]; label: string }

type SortKey = "report" | "site" | "parameter" | "value";
const PAGE_SIZES = [25, 50, 100] as const;
const PHASE_ORDER: Record<Phase, number> = { pre: 0, during: 1, after: 2 };

export default function EvidenceLedger({ rows, focus, onClearFocus }: { rows: Reading[]; focus: EvidenceFocus | null; onClearFocus: () => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "report", dir: 1 });
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const out = [...rows];
    const byReport = (a: Reading, b: Reading) => a.year - b.year || (a.festival === b.festival ? 0 : a.festival === "Ganesh" ? -1 : 1) || a.sourcePage - b.sourcePage || a.site.localeCompare(b.site) || PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    out.sort((a, b) => {
      let c = 0;
      if (sort.key === "site") c = a.site.localeCompare(b.site);
      else if (sort.key === "parameter") c = a.parameter.localeCompare(b.parameter);
      else if (sort.key === "value") {
        // Readings without a number always sort last, whichever direction.
        if (a.value === null && b.value === null) return byReport(a, b);
        if (a.value === null || b.value === null) return a.value === null ? 1 : -1;
        c = a.value - b.value;
      }
      return c * sort.dir || byReport(a, b);
    });
    return out;
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const header = (key: SortKey, label: string, cls?: string) => (
    <th scope="col" className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" className={styles.sortBtn} onClick={() => { setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 })); setPage(0); }}>
        {label}
        <span aria-hidden="true" className={styles.sortIcon}>{sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className={styles.panel}>
      {focus && (
        <div className={styles.focus} role="status">
          <span>
            Showing the <strong>{rows.length}</strong> reading{rows.length === 1 ? "" : "s"} behind: {focus.label}
          </span>
          <button type="button" onClick={onClearFocus}>Show all filtered readings</button>
        </div>
      )}

      <div className={styles.bar}>
        <p className={styles.count} aria-live="polite">
          {sorted.length === 0 ? "No readings match the current filters." : `Showing ${current * pageSize + 1}–${current * pageSize + slice.length} of ${sorted.length.toLocaleString("en-IN")} readings`}
        </p>
        <label className={styles.size}>
          Rows
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]); setPage(0); }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <p>Nothing to show. Widen the filters or clear the search; no reading is hidden for any other reason.</p>
        </div>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption className="visually-hidden">Evidence ledger. Values exactly as printed in the MPPCB reports, with source pages.</caption>
            <thead>
              <tr>
                {header("site", "Site")}
                {header("report", "Festival · phase")}
                {header("parameter", "Parameter")}
                {header("value", "Value", styles.num)}
                <th scope="col">As printed</th>
                <th scope="col">Unit <span aria-hidden="true">†</span><span className="visually-hidden">(assumed)</span></th>
                <th scope="col">Class B check</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => {
                const c = classBCheck(r);
                return (
                  <tr key={r.id}>
                    <td data-label="Site">
                      <span className={styles.site}>{r.site}</span>
                      <span className={styles.sub}>{r.waterBody}{r.siteMatchConfidence === "medium" ? " · match: medium" : ""}</span>
                    </td>
                    <td data-label="Festival · phase">
                      {r.festival} {r.year}
                      <span className={styles.sub}>{PHASE_SHORT[r.phase]} immersion</span>
                    </td>
                    <td data-label="Parameter">
                      {r.parameter}
                      {r.parameterAsPrinted !== r.parameter && <span className={styles.sub}>printed “{r.parameterAsPrinted}”</span>}
                    </td>
                    <td data-label="Value" className={`${styles.num} ${styles.value} ${r.status !== "measured" ? styles.novalue : ""}`}>{valueText(r)}</td>
                    <td data-label="As printed" className="mono">{r.valueAsPrinted === "" ? <span className={styles.sub}>(blank)</span> : r.valueAsPrinted}</td>
                    <td data-label="Unit (assumed)">{displayUnit(r)}</td>
                    <td data-label="Class B check">
                      <span className={`${styles.check} ${styles[`c_${c}`]}`}>
                        {c === "fails" && <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 1l5 9.5H1z" fill="var(--high)" /></svg>}
                        {checkLabel(r)}
                      </span>
                    </td>
                    <td data-label="Source">
                      <a href={pageUrl(r.sourceId, r.sourcePage)} target="_blank" rel="noopener noreferrer" className={styles.src}>
                        {REPORTS[r.sourceId].year} report, p. {r.sourcePage}
                        <span className="visually-hidden"> (opens the MPPCB PDF in a new tab)</span>
                        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M4 2h6v6M10 2L4 8M2 5v5h5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
                      </a>
                      <span className={r.verification === "auto-checked" ? styles.checked : styles.unverified}>
                        {r.verification === "auto-checked" ? "Auto-checked vs PDF text" : "Unverified"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > 0 && (
        <div className={styles.pager}>
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0}>Previous</button>
          <span className="tnum">Page {current + 1} of {pages}</span>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>Next</button>
        </div>
      )}

      <p className={styles.foot}>
        † The reports print no units; units are the standard ones for each test. “Auto-checked” means the value was matched cell by cell against the text layer of the
        cited PDF page by an automated script, not reviewed by a person. Page links open the official MPPCB PDF; most browsers jump to the page.
      </p>
    </div>
  );
}
