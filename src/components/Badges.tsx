import { CATEGORY_META, type Category, type EvidenceLevel } from "@/lib/screening";
import styles from "./Badges.module.css";

export function CategoryGlyph({ category, size = 12 }: { category: Category; size?: number }) {
  const s = size;
  const common = { width: s, height: s, viewBox: "0 0 12 12", "aria-hidden": true, focusable: false } as const;
  switch (category) {
    case "high":
      return <svg {...common}><path d="M6 1l5 9.5H1z" fill="var(--high)" /></svg>;
    case "elevated":
      return <svg {...common}><path d="M6 0.8L11.2 6 6 11.2 0.8 6z" fill="var(--elevated)" /></svg>;
    case "monitor":
      return <svg {...common}><circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--monitor)" strokeWidth="2" /></svg>;
    default:
      return <svg {...common}><circle cx="6" cy="6" r="4.4" fill="none" stroke="var(--insufficient)" strokeWidth="1.6" strokeDasharray="2.2 1.6" /></svg>;
  }
}

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className={`${styles.badge} ${styles[category]}`}>
      <CategoryGlyph category={category} />
      {CATEGORY_META[category].label}
    </span>
  );
}

const EVIDENCE_LABEL: Record<EvidenceLevel, string> = { strong: "Strong record", moderate: "Partial record", limited: "Thin record" };

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const bars = level === "strong" ? 3 : level === "moderate" ? 2 : 1;
  return (
    <span className={styles.evidence} title="Evidence strength is reported separately from concern">
      <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden="true" focusable="false">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={i * 5} y={8 - i * 3} width="3.5" height={4 + i * 3} rx="1" fill={i < bars ? "var(--deep-2)" : "var(--line-2)"} />
        ))}
      </svg>
      {EVIDENCE_LABEL[level]}
    </span>
  );
}

export function KindTag({ kind }: { kind: "measured" | "calculated" | "ai" | "recommendation" | "automatic" }) {
  const label = { measured: "Measured", calculated: "Calculated", ai: "AI draft", recommendation: "Suggested step", automatic: "Automatic summary" }[kind];
  return <span className={`${styles.kind} ${styles[`kind_${kind}`]}`}>{label}</span>;
}
