import styles from "./Masthead.module.css";

function countdown(days: number): string {
  if (days > 1) return `in ${days} days`;
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  return `${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
}

export function GhatMark({ size = 28 }: { size?: number }) {
  // Three ghat steps descending into a water line.
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="7" fill="#0f3d3b" />
      <path d="M5 9h7v4h4v4h4v3H5z" fill="#efece5" />
      <path d="M4 21.5c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4 2-1.4 4-1.4" fill="none" stroke="#3fb6a4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Masthead({ daysToVisarjan }: { daysToVisarjan: number }) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <GhatMark />
        <div>
          <span className={styles.name}>Ghat Watch</span>
          <span className={styles.sub}>Bhopal immersion-ghat water quality · historical evidence</span>
        </div>
      </div>
      <div className={styles.meta}>
        <span className={styles.chip}>
          <span className={styles.dot} aria-hidden="true" />
          Durga visarjan: Tue 20 Oct 2026, <strong>{countdown(daysToVisarjan)}</strong>
        </span>
        <span className={styles.data}>Data: MPPCB reports 2023–2025</span>
      </div>
    </header>
  );
}
