import { fmtNum } from "@/lib/format";
import { CATEGORY_META, type Category, type Overview, type SiteAssessment } from "@/lib/screening";
import { CategoryGlyph, KindTag } from "./Badges";
import styles from "./OverviewTiles.module.css";

function Meter({ part, whole, tone }: { part: number; whole: number; tone: "high" | "deep" }) {
  const pct = whole ? (part / whole) * 100 : 0;
  return (
    <svg className={styles.meter} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="100" height="6" rx="3" fill={tone === "high" ? "var(--high-wash)" : "var(--accent-wash)"} />
      {pct > 0 && <rect x="0" y="0" width={Math.max(pct, 2)} height="6" rx="3" fill={tone === "high" ? "var(--high)" : "var(--deep-2)"} />}
    </svg>
  );
}

const share = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

export default function OverviewTiles({ stats, assessments, scopeLabel }: { stats: Overview; assessments: SiteAssessment[]; scopeLabel: string }) {
  const counts = (["high", "elevated", "monitor", "insufficient"] as Category[]).map((c) => ({ c, n: assessments.filter((a) => a.category === c).length }));
  return (
    <div className={styles.grid} aria-label={`Overview for ${scopeLabel}`} role="group">
      <div className={styles.tile}>
        <span className={styles.label}>Sites in dataset</span>
        <span className={styles.value}>{stats.sites}</span>
        <span className={styles.note}>Bhopal ghats and kunds with MPPCB immersion tables</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>Period covered</span>
        <span className={styles.value}>{stats.firstYear}–{String(stats.lastYear).slice(2)}</span>
        <span className={styles.note}>Ganesh and Durga, before / during / one week after</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>Records in view</span>
        <span className={styles.value}>{fmtNum(stats.records)}</span>
        <span className={styles.note}>
          {fmtNum(stats.measured)} measured · {stats.belowDetection} below detection · {stats.notSampled} not sampled
        </span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>DO below 5 mg/L</span>
        <span className={styles.value}>
          {stats.doShortfall.fails}<span className={styles.of}> / {stats.doShortfall.measured}</span>
        </span>
        <Meter part={stats.doShortfall.fails} whole={stats.doShortfall.measured} tone="high" />
        <span className={styles.note}>{share(stats.doShortfall.fails, stats.doShortfall.measured)} of measured DO readings for the selected sites, years and phases</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>BOD above 3 mg/L</span>
        <span className={styles.value}>
          {stats.bodExceedance.fails}<span className={styles.of}> / {stats.bodExceedance.measured}</span>
        </span>
        <Meter part={stats.bodExceedance.fails} whole={stats.bodExceedance.measured} tone="high" />
        <span className={styles.note}>{share(stats.bodExceedance.fails, stats.bodExceedance.measured)} of measured BOD readings for the selected sites, years and phases</span>
      </div>
      <div className={`${styles.tile} ${styles.summary}`}>
        <span className={styles.label}>
          Screening summary <KindTag kind="calculated" />
        </span>
        <ul className={styles.counts}>
          {counts.map(({ c, n }) => (
            <li key={c}>
              <CategoryGlyph category={c} />
              <span className={styles.countN}>{n}</span>
              <span>{CATEGORY_META[c].label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
