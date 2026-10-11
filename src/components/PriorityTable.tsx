"use client";

import { fmtNum } from "@/lib/format";
import { RANKING_ORDER_TEXT, type ParamStats, type SiteAssessment } from "@/lib/screening";
import { CategoryBadge, EvidenceBadge } from "./Badges";
import styles from "./PriorityTable.module.css";

function Ratio({ s, label }: { s: ParamStats; label: string }) {
  if (!s.measured) return <span className={styles.muted}>no readings</span>;
  const w = (s.fails / s.measured) * 100;
  return (
    <span className={styles.ratio} aria-label={`${label}: ${s.fails} of ${s.measured} measured readings`}>
      <span className="tnum">{s.fails}<span className={styles.muted}>/{s.measured}</span></span>
      <svg viewBox="0 0 48 4" className={styles.bar} aria-hidden="true" focusable="false">
        <rect width="48" height="4" rx="2" fill="var(--line)" />
        {s.fails > 0 && <rect width={Math.max((w / 100) * 48, 2)} height="4" rx="2" fill="var(--high)" />}
      </svg>
    </span>
  );
}

export default function PriorityTable({ assessments, selectedId, onSelect }: { assessments: SiteAssessment[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className={styles.panel}>
      <table className={styles.table}>
        <caption className="visually-hidden">Sites ranked by screening category. {RANKING_ORDER_TEXT}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rank}>#</th>
            <th scope="col">Site</th>
            <th scope="col">Category</th>
            <th scope="col" className={styles.num}>DO &lt; 5</th>
            <th scope="col" className={styles.num}>Lowest DO</th>
            <th scope="col" className={styles.num}>BOD &gt; 3</th>
            <th scope="col" className={styles.num}>pH out</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => {
            const sel = a.siteId === selectedId;
            return (
              <tr key={a.siteId} className={sel ? styles.selected : undefined} onClick={() => onSelect(a.siteId)}>
                <td className={styles.rank} data-label="Rank">{a.rank}</td>
                <td data-label="Site" className={styles.siteCell}>
                  <button type="button" className={styles.siteBtn} aria-pressed={sel} onClick={(e) => { e.stopPropagation(); onSelect(a.siteId); }}>
                    <span className={styles.siteName}>{a.site}</span>
                    <span className={styles.water}>
                      {a.waterBodies.join(" / ")}
                      {a.matchConfidence === "medium" && <span className={styles.match}> · site match: medium</span>}
                    </span>
                  </button>
                  <EvidenceBadge level={a.evidence} />
                </td>
                <td data-label="Category"><CategoryBadge category={a.category} /></td>
                <td data-label="DO below 5 mg/L" className={styles.num}><Ratio s={a.stats.do} label="DO below 5 mg/L" /></td>
                <td data-label="Lowest DO (mg/L)" className={`${styles.num} tnum`}>
                  {a.stats.do.extreme ? fmtNum(a.stats.do.extreme.value as number) : <span className={styles.muted}>–</span>}
                </td>
                <td data-label="BOD above 3 mg/L" className={styles.num}><Ratio s={a.stats.bod} label="BOD above 3 mg/L" /></td>
                <td data-label="pH outside 6.5–8.5" className={`${styles.num} tnum`}>
                  {a.stats.ph.measured ? <>{a.stats.ph.fails}<span className={styles.muted}>/{a.stats.ph.measured}</span></> : <span className={styles.muted}>–</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.foot}>{RANKING_ORDER_TEXT} Counts are measured readings only; BDL and not-sampled cells are excluded, never counted as passing.</p>
    </div>
  );
}
