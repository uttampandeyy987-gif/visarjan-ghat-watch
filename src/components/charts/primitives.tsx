import type { Phase } from "@/lib/types";

export const PHASE_COLOR: Record<Phase, string> = { pre: "var(--phase-pre)", during: "var(--phase-during)", after: "var(--phase-after)" };

/**
 * Positions a tooltip over an SVG point given as fractions of the chart box.
 * Anchors left/right near the edges so it is never clipped. Uses CSSOM (allowed by the CSP), not a style attribute.
 */
export function placeTip(el: HTMLElement | null, fx: number, fy: number) {
  if (!el) return;
  el.style.left = `${fx * 100}%`;
  el.style.top = `${fy * 100}%`;
  const tx = fx < 0.25 ? "-8%" : fx > 0.75 ? "-92%" : "-50%";
  el.style.transform = `translate(${tx}, calc(-100% - 12px))`;
}

/** Clean axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1] < max) out.push(Number((out[out.length - 1] + step).toFixed(6)));
  return out;
}

/** Phase identity: colour AND shape (circle / diamond / square), with a 2px surface ring. */
export function PhaseMarker({ phase, x, y, r = 4.5, hollow = false }: { phase: Phase; x: number; y: number; r?: number; hollow?: boolean }) {
  const fill = hollow ? "var(--surface)" : PHASE_COLOR[phase];
  const stroke = hollow ? PHASE_COLOR[phase] : "var(--surface)";
  const sw = hollow ? 1.5 : 2;
  if (phase === "pre") return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />;
  if (phase === "during") {
    const d = r * 1.3;
    return <path d={`M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z`} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }
  const s = r * 0.95;
  return <rect x={x - s} y={y - s} width={s * 2} height={s * 2} rx="1.5" fill={fill} stroke={stroke} strokeWidth={sw} />;
}

export function PhaseLegend({ extra = true }: { extra?: boolean }) {
  return (
    <ul className="chart-legend">
      {(["pre", "during", "after"] as Phase[]).map((p) => (
        <li key={p}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><PhaseMarker phase={p} x={7} y={7} r={4} /></svg>
          {p === "pre" ? "Before immersion" : p === "during" ? "During immersion" : "One week after"}
        </li>
      ))}
      {extra && (
        <>
          <li>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M3 11l4-8 4 8z" fill="none" stroke="var(--ink-3)" strokeWidth="1.4" /></svg>
            Below detection (no value)
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M4 4l6 6M10 4l-6 6" stroke="var(--ink-3)" strokeWidth="1.5" /></svg>
            Not sampled
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><rect x="1" y="1" width="12" height="12" fill="url(#hatch)" stroke="var(--line-2)" /></svg>
            No table in report
          </li>
          <li>
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" focusable="false"><rect x="0" y="0" width="18" height="14" fill="var(--high-wash)" /><line x1="0" y1="7" x2="18" y2="7" stroke="var(--high)" strokeWidth="1.2" /></svg>
            Outside Class B benchmark
          </li>
        </>
      )}
    </ul>
  );
}

/** Shared SVG defs (hatch pattern). Render once per page. */
export function ChartDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="svg-defs">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--paper)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-2)" strokeWidth="2" />
        </pattern>
      </defs>
    </svg>
  );
}
