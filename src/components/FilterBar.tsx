"use client";

import { useId } from "react";
import { MAX_QUERY_LENGTH } from "@/lib/filters";
import { PHASE_LONG } from "@/lib/format";
import { isParameterId, PARAMETERS } from "@/lib/parameters";
import type { SiteInfo } from "@/lib/screening";
import { DEFAULT_FILTERS, FESTIVALS, PHASES, type Festival, type Filters, type Phase, type Reading } from "@/lib/types";
import styles from "./FilterBar.module.css";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  sites: SiteInfo[];
  readings: Reading[];
}

export default function FilterBar({ filters, onChange, sites, readings }: Props) {
  const id = useId();
  const years = [...new Set(readings.map((r) => r.year))].sort();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  return (
    <form className={styles.bar} role="search" aria-label="Filter readings" onSubmit={(e) => e.preventDefault()}>
      <div className={styles.field}>
        <label htmlFor={`${id}-site`}>Ghat / site</label>
        <select id={`${id}-site`} value={filters.site} onChange={(e) => set("site", e.target.value)}>
          <option value="all">All 7 sites</option>
          {sites.map((s) => (
            <option key={s.siteId} value={s.siteId}>{s.site}</option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-year`}>Year</label>
        <select id={`${id}-year`} value={String(filters.year)} onChange={(e) => set("year", e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">2023–2025</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-fest`}>Festival</label>
        <select id={`${id}-fest`} value={filters.festival} onChange={(e) => set("festival", e.target.value as Festival | "all")}>
          <option value="all">Ganesh and Durga</option>
          {FESTIVALS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-phase`}>Sampling phase</label>
        <select id={`${id}-phase`} value={filters.phase} onChange={(e) => set("phase", e.target.value as Phase | "all")}>
          <option value="all">All phases</option>
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LONG[p]}</option>)}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-param`}>Parameter</label>
        <select id={`${id}-param`} value={filters.parameter} onChange={(e) => set("parameter", isParameterId(e.target.value) ? e.target.value : "all")}>
          <option value="all">All 13 parameters</option>
          {PARAMETERS.map((p) => <option key={p.id} value={p.id}>{p.name}{p.classB ? ` (Class B ${p.classB.label})` : ""}</option>)}
        </select>
      </div>
      <div className={`${styles.field} ${styles.search}`}>
        <label htmlFor={`${id}-q`}>Search evidence</label>
        <input
          id={`${id}-q`}
          type="search"
          placeholder="Site or parameter, e.g. Hirdaram, D.Oxygen"
          value={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(e) => set("q", e.target.value.slice(0, MAX_QUERY_LENGTH))}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button type="button" className={styles.reset} onClick={() => onChange(DEFAULT_FILTERS)} disabled={isDefault}>
        Reset
      </button>
    </form>
  );
}
