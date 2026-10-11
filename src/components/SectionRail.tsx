"use client";

import { useEffect, useState } from "react";
import styles from "./SectionRail.module.css";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: "M3 13h4v6H3zM10 8h4v11h-4zM17 4h4v15h-4z" },
  { id: "priority", label: "Screening", icon: "M4 6h16M4 12h10M4 18h6" },
  { id: "trends", label: "Readings", icon: "M3 17l5-6 4 3 6-8 3 3" },
  { id: "evidence", label: "Evidence", icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" },
  { id: "method", label: "Method", icon: "M12 3v18M5 7h14M7 7l-3 7a3 3 0 006 0zM17 7l-3 7a3 3 0 006 0z" },
] as const;

export default function SectionRail({ scopeLabel }: { scopeLabel: string }) {
  const [active, setActive] = useState<string>("overview");

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.wrap}>
      <nav className={styles.rail} aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.item} aria-current={active === s.id ? "location" : undefined}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d={s.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{s.label}</span>
          </a>
        ))}
      </nav>
      <p className={styles.scope} aria-live="polite">
        <span className="visually-hidden">Current view: </span>
        {scopeLabel}
      </p>
    </div>
  );
}
