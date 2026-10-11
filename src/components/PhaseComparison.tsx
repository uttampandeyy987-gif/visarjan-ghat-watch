"use client";

import { useState } from "react";
import { fmtNum, PHASE_LONG, reportLabel } from "@/lib/format";
import { failsClassB, parameterById } from "@/lib/parameters";
import { phaseSummary } from "@/lib/screening";
import { PHASES, type ParameterId, type Reading } from "@/lib/types";
import { niceTicks, PhaseMarker, placeTip } from "./charts/primitives";
import styles from "./PhaseComparison.module.css";

// Drawn near its rendered width so SVG text stays at its nominal size.
const W = 600;
const H = 320;
const M = { top: 14, right: 12, bottom: 62, left: 40 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

/** Deterministic jitter so the layout is stable across renders. */
function jitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

export default function PhaseComparison({ readings, parameter }: { readings: Reading[]; parameter: ParameterId }) {
  const [tip, setTip] = useState<{ x: number; y: number; r: Reading } | null>(null);
  const info = parameterById(parameter);
  const b = info.classB;
  const rows = readings.filter((r) => r.parameterId === parameter && r.status === "measured");
  const summary = phaseSummary(readings, parameter);
  const vals = [...rows.map((r) => r.value as number), ...(b?.min !== undefined ? [b.min] : []), ...(b?.max !== undefined ? [b.max] : [])];
  const ticks = vals.length ? niceTicks(parameter === "ph" ? Math.min(6, ...vals) : 0, Math.max(...vals), 5) : [0, 1];
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const y = (v: number) => M.top + PH - ((v - y0) / (y1 - y0)) * PH;
  const band = PW / 3;
  const cx = (i: number) => M.left + band * i + band / 2;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h3>Before, during and after immersion</h3>
        <p>
          {info.name}, all measured readings in view pooled across sites and festivals. Bar = median. Sites differ in baseline, so this shows the
          overall pattern, not a per-site change.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>No measured {info.name.toLowerCase()} values in this view.</p>
      ) : (
        <div className={styles.svgWrap}>
          <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={`${info.name} by phase. ${summary.map((s) => `${PHASE_LONG[s.phase]}: ${s.measured} readings, median ${s.median === null ? "none" : fmtNum(Number(s.median.toFixed(2)))}`).join(". ")}.`}>
            {b?.kind === "min" && <rect x={M.left} y={y(b.min!)} width={PW} height={Math.max(y(y0) - y(b.min!), 0)} fill="var(--high-wash)" />}
            {b?.kind === "max" && <rect x={M.left} y={M.top} width={PW} height={Math.max(y(b.max!) - M.top, 0)} fill="var(--high-wash)" />}
            {b?.kind === "range" && (
              <>
                <rect x={M.left} y={M.top} width={PW} height={Math.max(y(b.max!) - M.top, 0)} fill="var(--high-wash)" />
                <rect x={M.left} y={y(b.min!)} width={PW} height={Math.max(y(y0) - y(b.min!), 0)} fill="var(--high-wash)" />
              </>
            )}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
                <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className={styles.tick}>{fmtNum(t)}</text>
              </g>
            ))}
            {b?.min !== undefined && <line x1={M.left} x2={W - M.right} y1={y(b.min)} y2={y(b.min)} stroke="var(--high)" strokeWidth="1.2" />}
            {b?.max !== undefined && <line x1={M.left} x2={W - M.right} y1={y(b.max)} y2={y(b.max)} stroke="var(--high)" strokeWidth="1.2" />}
            {PHASES.map((p, i) => {
              const s = summary[i];
              return (
                <g key={p}>
                  {rows.filter((r) => r.phase === p).map((r) => {
                    const px = cx(i) + jitter(r.id) * band * 0.5;
                    const py = y(r.value as number);
                    return (
                      <g key={r.id} onMouseEnter={() => setTip({ x: px, y: py, r })} onMouseLeave={() => setTip(null)}>
                        <circle cx={px} cy={py} r="9" fill="transparent" />
                        <PhaseMarker phase={p} x={px} y={py} r={3.6} />
                      </g>
                    );
                  })}
                  {s.median !== null && <line x1={cx(i) - band * 0.32} x2={cx(i) + band * 0.32} y1={y(s.median)} y2={y(s.median)} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />}
                  <text x={cx(i)} y={H - 40} textAnchor="middle" className={styles.label}>{PHASE_LONG[p]}</text>
                  <text x={cx(i)} y={H - 24} textAnchor="middle" className={styles.tick}>
                    n={s.measured}{s.median !== null ? ` · median ${fmtNum(Number(s.median.toFixed(2)))}` : ""}
                  </text>
                  {b && <text x={cx(i)} y={H - 9} textAnchor="middle" className={styles.tick}>{s.fails} outside benchmark</text>}
                </g>
              );
            })}
          </svg>
          {tip && (
            <div className="chart-tooltip" ref={(el) => placeTip(el, tip.x / W, tip.y / H)}>
              <strong>{fmtNum(tip.r.value as number)}{tip.r.unitAssumed ? ` ${tip.r.unitAssumed.replace("mg/l", "mg/L")}` : ""}</strong> · {tip.r.site}
              <br />
              {tip.r.festival} {tip.r.year} · {reportLabel(tip.r)}{failsClassB(parameter, tip.r.value) ? " · outside benchmark" : ""}
            </div>
          )}
        </div>
      )}
      <p className={styles.note}>
        Not counted: {summary.reduce((n, s) => n + s.notMeasured, 0)} {info.name} cells in view that were below detection or not sampled.
      </p>
    </div>
  );
}
