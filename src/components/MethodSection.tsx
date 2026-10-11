import { PARAMETERS } from "@/lib/parameters";
import { CATEGORY_META, RANKING_ORDER_TEXT, RULES, type Category } from "@/lib/screening";
import { CONTEXT_SOURCES, DATASET_SOURCE, EXCLUDED_SOURCES, REPORTS, STANDARD_SOURCE, type Source } from "@/lib/sources";
import type { DatasetIssue } from "@/lib/types";
import { CategoryGlyph } from "./Badges";
import styles from "./MethodSection.module.css";

interface Props {
  issues: DatasetIssue[];
  rowsRead: number;
  readingsLoaded: number;
  verificationMethod: string;
  verificationCheckedOn: string;
  tables: { checked: number; total: number };
}

function SourceItem({ s }: { s: Source }) {
  return (
    <li>
      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
      <span className={styles.pub}> · {s.publisher}</span>
      <p>{s.use}</p>
    </li>
  );
}

const ORDER: Category[] = ["insufficient", "high", "elevated", "monitor"];

export default function MethodSection({ issues, rowsRead, readingsLoaded, verificationMethod, verificationCheckedOn, tables }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 id="method-title">Method, sources and limits</h2>
        <p>Everything that decides a category is on this page. The rules below are rendered from the same constants the calculation uses.</p>
      </div>

      <div className={styles.cols}>
        <article className={styles.card}>
          <h3>Benchmarks</h3>
          <p>
            CPCB designated-best-use criteria, <strong>Class B: organised outdoor bathing</strong>. Immersion ghats are public water-contact sites, so the bathing
            class is a reasonable screening reference. It is not the legal standard for every use of these water bodies, and the result is not a regulatory
            determination.
          </p>
          <table className={styles.table}>
            <thead><tr><th scope="col">Parameter</th><th scope="col">Class B</th><th scope="col">Unit (assumed)</th></tr></thead>
            <tbody>
              {PARAMETERS.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  <td>{p.classB ? p.classB.label : <span className={styles.muted}>No limit set</span>}</td>
                  <td>{p.unit ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.small}>Class B also sets total coliform ≤ 500 MPN/100 mL, but coliform was not measured in these immersion tables.</p>
        </article>

        <article className={styles.card}>
          <h3>Screening rules</h3>
          <p>Applied per site to the measured readings in the current view. The first rule that matches decides the category.</p>
          <ol className={styles.rules}>
            {ORDER.map((c) => (
              <li key={c}>
                <span className={styles.ruleName}><CategoryGlyph category={c} /> {CATEGORY_META[c].label}</span>
                <p>{CATEGORY_META[c].rule}</p>
              </li>
            ))}
          </ol>
          <p className={styles.small}>{RANKING_ORDER_TEXT}</p>
          <h4>Evidence strength (reported separately)</h4>
          <p className={styles.small}>
            Coverage = measured DO, BOD and pH readings ÷ the readings expected for the view (festivals × phases × 3). Strong ≥ {RULES.strongCoverage * 100}%,
            Partial ≥ {RULES.moderateCoverage * 100}%, otherwise Thin. A medium-confidence site match or any unverified reading caps strength at Partial.
          </p>
        </article>

        <article className={styles.card}>
          <h3>How the data is handled</h3>
          <ul className={styles.list}>
            <li><strong>BDL / ND</strong> (below detection) is kept as “below detection” with no number. It is never zero and never missing.</li>
            <li><strong>Blank, “_”, “-”, “*”, “**”</strong> mean not sampled. They are excluded from counts and never treated as clean.</li>
            <li><strong>No table</strong>: the report has no table for that site and festival (Bairagarh and Malikhedi, Durga 2025). These count against coverage.</li>
            <li><strong>Printed values are kept</strong> next to the normalised number, along with the printed parameter and site labels.</li>
            <li><strong>Site matching</strong>: one standard name per ghat, from the dataset. <em>Rani Kamlapati ghat / Kamla Park kund</em> is medium confidence: Ganesh tables print “Kamla Park … kund”, Durga tables “Rani Kamlapati … ghat (lower lake)”. They may be two places, and the tool does not merge or split them.</li>
            <li><strong>Charts</strong> join phases within one festival only. They never draw a line across a gap or between festivals.</li>
            <li><strong>AI text</strong> (optional) is drafted by Claude from the calculated findings only. It is rejected if it cites a page or number not in the evidence, or claims the water is safe. It never changes a category.</li>
          </ul>
        </article>

        <article className={styles.card}>
          <h3>Verification of the dataset</h3>
          <p>
            {readingsLoaded.toLocaleString("en-IN")} of {rowsRead.toLocaleString("en-IN")} rows passed validation
            {issues.length ? `; ${issues.length} were excluded (shown below).` : "; none were excluded."}
          </p>
          <p className={styles.small}>
            {verificationMethod} Run on {verificationCheckedOn}. Result: {tables.checked} of {tables.total} site-festival tables matched their cited page
            {tables.checked < tables.total ? "; readings from the others are marked Unverified." : "."} A planted-error test confirmed the check detects changed values,
            changed codes and swapped phases.
          </p>
          {issues.length > 0 && (
            <details className={styles.issues}>
              <summary>Excluded rows ({issues.length})</summary>
              <ul>{issues.slice(0, 50).map((i) => <li key={`${i.row}-${i.message}`}>Row {i.row}: {i.message}</li>)}</ul>
            </details>
          )}
          <h4>Known limits</h4>
          <ul className={styles.list}>
            <li>Units are assumed; the reports print none.</li>
            <li>Only 4 metals were tested (chromium, lead, zinc, copper). Nothing is inferred for untested substances.</li>
            <li>Sampling dates within each phase are not given in the dataset, so none are shown.</li>
            <li>Readings are from 2023–2025. They cannot show present conditions or the effect of the new ghats.</li>
          </ul>
        </article>
      </div>

      <article className={styles.card}>
        <h3>Sources</h3>
        <div className={styles.sourceCols}>
          <div>
            <h4>Used for the readings</h4>
            <ul className={styles.sources}>
              {Object.values(REPORTS).map((s) => <SourceItem key={s.id} s={s} />)}
              <SourceItem s={DATASET_SOURCE} />
              <SourceItem s={STANDARD_SOURCE} />
            </ul>
          </div>
          <div>
            <h4>Context</h4>
            <ul className={styles.sources}>{CONTEXT_SOURCES.map((s) => <SourceItem key={s.id} s={s} />)}</ul>
            <h4>Inspected, not combined</h4>
            <ul className={styles.sources}>{EXCLUDED_SOURCES.map((s) => <SourceItem key={s.id} s={s} />)}</ul>
          </div>
        </div>
      </article>
    </div>
  );
}
