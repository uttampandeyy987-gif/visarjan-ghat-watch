"use client";

import { useMemo, useState } from "react";
import { fmtNum, PHASE_SHORT, reportLabel, valueText } from "@/lib/format";
import { failsClassB, parameterById, PARAMETERS } from "@/lib/parameters";
import { eventsIn, type EventKey } from "@/lib/screening";
import { PHASES, type ParameterId, type Phase, type Reading } from "@/lib/types";
import { ChartDefs, niceTicks, PHASE_COLOR, PhaseLegend, PhaseMarker, placeTip } from "./charts/primitives";
import styles from "./EventProfile.module.css";

const W = 320;
const H = 176;
const M = { top: 12, right: 8, bottom: 30, left: 34 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;
const MAIN_TABS: ParameterId[] = ["do", "bod", "ph"];

interface Props {
  readings: Reading[];
  universe: Reading[];
  sites: { siteId: string; site: string }[];
  parameter: ParameterId;
  onParameterChange: (p: ParameterId) => void;
  parameterLocked: boolean;
}

interface Tip { x: number; y: number; r: Reading }

const evKey = (e: { year: number; festival: string }) => `${e.year}|${e.festival}`;
const evShort = (e: EventKey) => `${e.festival[0]} ’${String(e.year).slice(2)}`;

export default function EventProfile({ readings, universe, sites, parameter, onParameterChange, parameterLocked }: Props) {
  const [tableView, setTableView] = useState(false);
  const [tip, setTip] = useState<{ site: string; t: Tip } | null>(null);
  const info = parameterById(parameter);
  const events = useMemo(() => eventsIn(universe), [universe]);
  const phases = PHASES.filter((p) => universe.some((r) => r.phase === p));
  const rows = useMemo(() => readings.filter((r) => r.parameterId === parameter), [readings, parameter]);
  // A table exists for (site, event) if any parameter was printed for it.
  const tables = useMemo(() => new Set(readings.map((r) => `${r.siteId}|${evKey(r)}`)), [readings]);

  const measured = rows.filter((r) => r.status === "measured").map((r) => r.value as number);
  const b = info.classB;
  const domainVals = [...measured, ...(b?.min !== undefined ? [b.min] : []), ...(b?.max !== undefined ? [b.max] : [])];
  const lo = parameter === "ph" ? Math.min(6, ...domainVals) : 0;
  const ticks = domainVals.length ? niceTicks(lo, Math.max(...domainVals), 4) : [0, 1];
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const y = (v: number) => M.top + PH - ((v - y0) / (y1 - y0)) * PH;
  const groupW = PW / Math.max(events.length, 1);
  const x = (ei: number, p: Phase) => M.left + groupW * ei + groupW * ((phases.indexOf(p) + 1) / (phases.length + 1));

  const otherParams = PARAMETERS.filter((p) => !MAIN_TABS.includes(p.id));
  const unitText = info.unit ? `${info.unit}, assumed` : "pH units";

  return (
    <div className={styles.panel}>
      <ChartDefs />
      <div className={styles.toolbar}>
        <div className={styles.tabs} role="group" aria-label="Parameter shown">
          {MAIN_TABS.map((p) => (
            <button key={p} type="button" aria-pressed={parameter === p} disabled={parameterLocked && parameter !== p} onClick={() => onParameterChange(p)}>
              {parameterById(p).name}
            </button>
          ))}
          <label className={styles.otherLabel}>
            <span className="visually-hidden">Other parameter</span>
            <select value={MAIN_TABS.includes(parameter) ? "" : parameter} disabled={parameterLocked} onChange={(e) => e.target.value && onParameterChange(e.target.value as ParameterId)}>
              <option value="">Other parameter…</option>
              {otherParams.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className={styles.toggle} aria-pressed={tableView} onClick={() => setTableView((v) => !v)}>
          {tableView ? "Show charts" : "Show as table"}
        </button>
      </div>

      <div className={styles.caption}>
        <h3>{info.name} <span>({unitText})</span></h3>
        <p>
          {b ? <>CPCB Class B benchmark: <strong>{b.label}</strong>. Shaded band = outside the benchmark.</> : <>CPCB sets no Class B limit for {info.name.toLowerCase()}, so no pass/fail line is drawn.</>}
          {parameterLocked && " Parameter chosen in the filters."} Same vertical scale on every site, so heights are comparable.
        </p>
      </div>

      {tableView ? (
        <ProfileTable rows={rows} tables={tables} sites={sites} events={events} phases={phases} />
      ) : (
        <>
          <div className={styles.grid}>
            {sites.map((s) => {
              const own = rows.filter((r) => r.siteId === s.siteId);
              const fails = own.filter((r) => failsClassB(parameter, r.value) === true).length;
              const nMeasured = own.filter((r) => r.status === "measured").length;
              return (
                <figure key={s.siteId} className={styles.cell}>
                  <figcaption>
                    <span className={styles.siteName} title={s.site}>{s.site}</span>
                    <span className={styles.siteStat}>
                      {nMeasured} measured{b ? ` · ${fails} outside` : ""}
                    </span>
                  </figcaption>
                  <div className={styles.svgWrap}>
                    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${info.name} at ${s.site}: ${nMeasured} measured readings${b ? `, ${fails} outside the Class B benchmark` : ""}. Use “Show as table” for values.`}>
                      {b?.kind === "min" && <rect x={M.left} y={y(b.min!)} width={PW} height={Math.max(y(y0) - y(b.min!), 0)} fill="var(--high-wash)" />}
                      {b?.kind === "max" && <rect x={M.left} y={M.top} width={PW} height={Math.max(y(b.max!) - M.top, 0)} fill="var(--high-wash)" />}
                      {b?.kind === "range" && (
                        <>
                          <rect x={M.left} y={M.top} width={PW} height={Math.max(y(b.max!) - M.top, 0)} fill="var(--high-wash)" />
                          <rect x={M.left} y={y(b.min!)} width={PW} height={Math.max(y(y0) - y(b.min!), 0)} fill="var(--high-wash)" />
                        </>
                      )}
                      {events.map((e, ei) => !own.some((r) => evKey(r) === evKey(e)) && (
                        <g key={`nt-${ei}`}>
                          <rect x={M.left + groupW * ei + 2} y={M.top} width={groupW - 4} height={PH} fill="url(#hatch)" opacity="0.8" />
                          <text x={M.left + groupW * ei + groupW / 2} y={M.top + PH / 2} textAnchor="middle" className={styles.noTable}>
                            {tables.has(`${s.siteId}|${evKey(e)}`) ? "not reported" : "no table"}
                          </text>
                        </g>
                      ))}
                      {ticks.map((t) => (
                        <g key={t}>
                          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
                          <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className={styles.tick}>{fmtNum(t)}</text>
                        </g>
                      ))}
                      {b?.min !== undefined && <line x1={M.left} x2={W - M.right} y1={y(b.min)} y2={y(b.min)} stroke="var(--high)" strokeWidth="1.2" />}
                      {b?.max !== undefined && <line x1={M.left} x2={W - M.right} y1={y(b.max)} y2={y(b.max)} stroke="var(--high)" strokeWidth="1.2" />}
                      {events.map((e, ei) => (
                        <g key={`ev-${ei}`}>
                          {ei > 0 && <line x1={M.left + groupW * ei} x2={M.left + groupW * ei} y1={M.top} y2={M.top + PH} stroke="var(--line)" strokeWidth="1" />}
                          <text x={M.left + groupW * ei + groupW / 2} y={H - 10} textAnchor="middle" className={styles.tick}>{evShort(e)}</text>
                        </g>
                      ))}
                      {events.map((e, ei) => {
                        const pts = phases.map((p) => own.find((r) => evKey(r) === evKey(e) && r.phase === p));
                        return pts.slice(1).map((r, i) => {
                          const prev = pts[i];
                          if (!r || !prev || r.status !== "measured" || prev.status !== "measured") return null;
                          return <line key={`ln-${ei}-${i}`} x1={x(ei, prev.phase)} y1={y(prev.value as number)} x2={x(ei, r.phase)} y2={y(r.value as number)} stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />;
                        });
                      })}
                      {own.map((r) => {
                        const ei = events.findIndex((e) => evKey(e) === evKey(r));
                        if (ei < 0) return null;
                        const cx = x(ei, r.phase);
                        if (r.status === "measured") {
                          const cy = y(r.value as number);
                          return (
                            <g key={r.id} className={styles.mark} onMouseEnter={() => setTip({ site: s.siteId, t: { x: cx, y: cy, r } })} onMouseLeave={() => setTip(null)}>
                              <circle cx={cx} cy={cy} r="11" fill="transparent" />
                              <PhaseMarker phase={r.phase} x={cx} y={cy} />
                            </g>
                          );
                        }
                        const by = M.top + PH - 6;
                        return (
                          <g key={r.id} className={styles.mark} onMouseEnter={() => setTip({ site: s.siteId, t: { x: cx, y: by, r } })} onMouseLeave={() => setTip(null)}>
                            <circle cx={cx} cy={by} r="10" fill="transparent" />
                            {r.status === "below-detection"
                              ? <path d={`M${cx - 4} ${by + 3.5}L${cx} ${by - 4}L${cx + 4} ${by + 3.5}Z`} fill="var(--surface)" stroke={PHASE_COLOR[r.phase]} strokeWidth="1.4" />
                              : <path d={`M${cx - 3.5} ${by - 3.5}l7 7M${cx + 3.5} ${by - 3.5}l-7 7`} stroke="var(--ink-3)" strokeWidth="1.5" />}
                          </g>
                        );
                      })}
                    </svg>
                    {tip && tip.site === s.siteId && <Tooltip tip={tip.t} />}
                  </div>
                </figure>
              );
            })}
          </div>
          <div className={styles.legendRow}>
            <PhaseLegend />
            <p className={styles.axisNote}>G = Ganesh, D = Durga, ’23 = 2023. Ganesh precedes Durga each year.</p>
          </div>
        </>
      )}
    </div>
  );
}

function Tooltip({ tip }: { tip: Tip }) {
  const { r } = tip;
  return (
    <div className="chart-tooltip" ref={(el) => placeTip(el, tip.x / W, tip.y / H)}>
      <strong>{valueText(r)}{r.status === "measured" && r.unitAssumed ? ` ${r.unitAssumed.replace("mg/l", "mg/L")}` : ""}</strong>
      {" · "}{PHASE_SHORT[r.phase]} immersion, {r.festival} {r.year}
      <br />
      Printed as “{r.valueAsPrinted || "blank"}” · {reportLabel(r)}
    </div>
  );
}

function ProfileTable({ rows, tables, sites, events, phases }: { rows: Reading[]; tables: Set<string>; sites: { siteId: string; site: string }[]; events: EventKey[]; phases: Phase[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Site</th>
            <th scope="col">Festival</th>
            {phases.map((p) => <th key={p} scope="col" className={styles.num}>{PHASE_SHORT[p]}</th>)}
            <th scope="col">Report page</th>
          </tr>
        </thead>
        <tbody>
          {sites.flatMap((s) => events.map((e) => {
            const cells = phases.map((p) => rows.find((r) => r.siteId === s.siteId && r.year === e.year && r.festival === e.festival && r.phase === p));
            const page = cells.find(Boolean)?.sourcePage;
            return (
              <tr key={`${s.siteId}-${evKey(e)}`}>
                <th scope="row">{s.site}</th>
                <td>{e.festival} {e.year}</td>
                {cells.map((c, i) => (
                  <td key={i} className={`${styles.num} ${c && failsClassB(c.parameterId, c.value) ? styles.fail : ""}`}>
                    {c ? valueText(c) : <span className={styles.muted}>{tables.has(`${s.siteId}|${evKey(e)}`) ? "not reported" : "no table"}</span>}
                  </td>
                ))}
                <td>{page ? `p. ${page}` : "–"}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}
