"use client";

import { parameterById } from "@/lib/parameters";
import { suggestedSteps } from "@/lib/recommend";
import { CATEGORY_META, type Reason, type SiteAssessment } from "@/lib/screening";
import type { Filters } from "@/lib/types";
import AiExplain from "./AiExplain";
import { CategoryBadge, EvidenceBadge, KindTag } from "./Badges";
import styles from "./SitePanel.module.css";

const REASON_ICON: Record<Reason["kind"], string> = {
  concern: "M8 2l6.5 11H1.5z",
  data: "M3 3h10v10H3z",
  caveat: "M8 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13z",
};

interface Props {
  assessment: SiteAssessment;
  filters: Filters;
  aiAvailable: boolean;
  onShowEvidence: (ids: string[], label: string) => void;
}

export default function SitePanel({ assessment: a, filters, aiAvailable, onShowEvidence }: Props) {
  return (
    <aside className={styles.panel} aria-labelledby="site-panel-title">
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <span className={styles.rank} aria-label={`Rank ${a.rank}`}>#{a.rank}</span>
          <h3 id="site-panel-title">{a.site}</h3>
        </div>
        <p className={styles.water}>{a.waterBodies.join(" / ")}</p>
        <div className={styles.badges}>
          <CategoryBadge category={a.category} />
          <EvidenceBadge level={a.evidence} />
        </div>
      </header>

      <div className={styles.block}>
        <div className={styles.blockHead}><KindTag kind="calculated" /><span>Why this category</span></div>
        <p className={styles.rule}>{CATEGORY_META[a.category].rule}</p>
        <ul className={styles.reasons}>
          {a.reasons.map((r, i) => (
            <li key={i} className={styles[r.kind]}>
              <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d={REASON_ICON[r.kind]} /></svg>
              <div>
                <p>{r.text}</p>
                {r.readingIds.length > 0 && (
                  <button type="button" className={styles.link} onClick={() => onShowEvidence(r.readingIds, `${a.site}: ${r.text}`)}>
                    Show {r.readingIds.length === 1 ? "this reading" : `these ${r.readingIds.length} readings`} in the ledger
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHead}><KindTag kind="calculated" /><span>Completeness, separate from concern</span></div>
        <div className={styles.coverage}>
          {(["do", "bod", "ph"] as const).map((k) => {
            const s = a.stats[k];
            const p = parameterById(k);
            const segs = [
              { n: s.measured, c: "var(--deep-2)", t: "measured" },
              { n: s.belowDetection, c: "var(--accent)", t: "below detection" },
              { n: s.notSampled, c: "var(--line-2)", t: "not sampled" },
              { n: s.noTable, c: "var(--paper-2)", t: "no table" },
            ];
            let x = 0;
            return (
              <div key={k} className={styles.covRow}>
                <span className={styles.covLabel}>{p.short}</span>
                <svg viewBox={`0 0 ${Math.max(s.expected, 1)} 8`} preserveAspectRatio="none" className={styles.covBar} aria-hidden="true" focusable="false">
                  {segs.map((g) => {
                    const el = g.n > 0 ? <rect key={g.t} x={x} width={Math.max(g.n - 0.08, 0.05)} height="8" fill={g.c} /> : null;
                    x += g.n;
                    return el;
                  })}
                </svg>
                <span className={`${styles.covText} tnum`}>{s.measured}/{s.expected} measured{s.notSampled ? ` · ${s.notSampled} not sampled` : ""}{s.noTable ? ` · ${s.noTable} no table` : ""}</span>
              </div>
            );
          })}
        </div>
        <ul className={styles.notes}>
          {a.evidenceNotes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        {a.sitesAsPrinted.length > 0 && (
          <details className={styles.printed}>
            <summary>Site names as printed in the reports ({a.sitesAsPrinted.length})</summary>
            <ul>{a.sitesAsPrinted.map((s) => <li key={s} className="mono">{s}</li>)}</ul>
          </details>
        )}
      </div>

      <div className={styles.block}>
        <div className={styles.blockHead}><KindTag kind="recommendation" /><span>Rule-based, for the officer’s judgement</span></div>
        <ul className={styles.steps}>
          {suggestedSteps(a).map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>

      <AiExplain assessment={a} filters={filters} aiAvailable={aiAvailable} />
    </aside>
  );
}
