import { eventsIn, type SiteAssessment } from "@/lib/screening";
import { PHASES, type Reading } from "@/lib/types";
import styles from "./CoverageMatrix.module.css";

const CORE = new Set(["do", "bod", "ph"]);

export default function CoverageMatrix({ readings, universe, assessments }: { readings: Reading[]; universe: Reading[]; assessments: SiteAssessment[] }) {
  const events = eventsIn(universe);
  const phases = PHASES.filter((p) => universe.some((r) => r.phase === p));
  const expected = phases.length * CORE.size;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h3>What was actually measured</h3>
        <p>Measured DO, BOD and pH values per site and festival, out of {expected} possible ({phases.length} phase{phases.length === 1 ? "" : "s"} × 3 parameters). Gaps are never treated as clean.</p>
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Site</th>
              {events.map((e) => <th key={`${e.year}${e.festival}`} scope="col">{e.festival}<br />{e.year}</th>)}
            </tr>
          </thead>
          <tbody>
            {assessments.map((a) => (
              <tr key={a.siteId}>
                <th scope="row">{a.site}</th>
                {events.map((e) => {
                  const own = readings.filter((r) => r.siteId === a.siteId && r.year === e.year && r.festival === e.festival);
                  if (own.length === 0) return <td key={`${e.year}${e.festival}`} className={styles.none}>no table</td>;
                  const n = own.filter((r) => CORE.has(r.parameterId) && r.status === "measured").length;
                  const cls = n === expected ? styles.full : n === 0 ? styles.zero : styles.partial;
                  return <td key={`${e.year}${e.festival}`} className={cls}><span className="tnum">{n}/{expected}</span></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={`chart-legend ${styles.legend}`}>
        <li><span className={`${styles.sw} ${styles.full}`} />All measured</li>
        <li><span className={`${styles.sw} ${styles.partial}`} />Some not sampled</li>
        <li><span className={`${styles.sw} ${styles.zero}`} />Table, no core values</li>
        <li><span className={`${styles.sw} ${styles.none}`} />No table in report</li>
      </ul>
    </div>
  );
}
