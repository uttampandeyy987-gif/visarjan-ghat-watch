"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { applyFilters, applyScope, describeFilters, filtersToSearch } from "@/lib/filters";
import { assessSites, overview, siteCatalog } from "@/lib/screening";
import type { DatasetIssue, Filters, ParameterId, Reading } from "@/lib/types";
import CoverageMatrix from "./CoverageMatrix";
import styles from "./Dashboard.module.css";
import EventProfile from "./EventProfile";
import EvidenceLedger, { type EvidenceFocus } from "./EvidenceLedger";
import ExportBar from "./ExportBar";
import FilterBar from "./FilterBar";
import Masthead from "./Masthead";
import MethodSection from "./MethodSection";
import OverviewTiles from "./OverviewTiles";
import PhaseComparison from "./PhaseComparison";
import PriorityTable from "./PriorityTable";
import SectionRail from "./SectionRail";
import SitePanel from "./SitePanel";

export interface DashboardProps {
  readings: Reading[];
  issues: DatasetIssue[];
  rowsRead: number;
  verificationMethod: string;
  verificationCheckedOn: string;
  initialFilters: Filters;
  daysToVisarjan: number;
  aiAvailable: boolean;
}

export default function Dashboard(props: DashboardProps) {
  const { readings } = props;
  const [filters, setFilters] = useState<Filters>(props.initialFilters);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<EvidenceFocus | null>(null);
  const [chartParam, setChartParam] = useState<ParameterId>("do");

  const catalog = useMemo(() => siteCatalog(readings), [readings]);
  const tableCheck = useMemo(() => {
    const t = new Map<string, boolean>();
    for (const r of readings) {
      const k = `${r.year}|${r.festival}|${r.siteId}`;
      t.set(k, (t.get(k) ?? true) && r.verification === "auto-checked");
    }
    return { checked: [...t.values()].filter(Boolean).length, total: t.size };
  }, [readings]);
  const siteName = useCallback((id: string) => catalog.find((s) => s.siteId === id)?.site ?? id, [catalog]);

  // One slice feeds every panel, chart, table and export.
  const scoped = useMemo(() => applyScope(readings, filters), [readings, filters]);
  const universe = useMemo(() => applyScope(readings, { ...filters, site: "all" }), [readings, filters]);
  const view = useMemo(() => applyFilters(readings, filters), [readings, filters]);
  const assessments = useMemo(
    () => assessSites(scoped, universe, filters.site === "all" ? catalog : catalog.filter((s) => s.siteId === filters.site)),
    [scoped, universe, catalog, filters.site],
  );
  const stats = useMemo(() => overview(readings, view, scoped), [readings, view, scoped]);
  const scopeLabel = describeFilters(filters, siteName);

  const activeSite = assessments.find((a) => a.siteId === selected) ?? assessments[0] ?? null;
  const effectiveChartParam: ParameterId = filters.parameter !== "all" ? filters.parameter : chartParam;

  // Keep the URL shareable without triggering a server round-trip.
  useEffect(() => {
    const next = `${window.location.pathname}${filtersToSearch(filters)}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
  }, [filters]);

  const updateFilters = (f: Filters) => {
    setFilters(f);
    setFocus(null);
    if (f.site !== "all") setSelected(f.site);
  };

  const showEvidence = (ids: string[], label: string) => {
    setFocus({ ids, label });
    requestAnimationFrame(() => document.getElementById("evidence")?.scrollIntoView({ block: "start" }));
  };

  const ledgerRows = useMemo(() => {
    if (!focus) return view;
    const set = new Set(focus.ids);
    return scoped.filter((r) => set.has(r.id));
  }, [focus, view, scoped]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Masthead daysToVisarjan={props.daysToVisarjan} />
      <SectionRail scopeLabel={scopeLabel} />

      <main id="main" className={styles.main}>
        <section id="overview" className={styles.section} aria-labelledby="overview-title">
          <div className={styles.intro}>
            <h1 id="overview-title" className={styles.title}>Which ghats need attention before Durga visarjan?</h1>
            <p className={styles.lede}>
              Historical readings from the MPPCB immersion reports, 2023 to 2025, compared with the CPCB Class B (outdoor bathing)
              criteria. These are past measurements, not current water quality, and not a regulatory determination.
            </p>
          </div>

          <div className={styles.controls}>
            <FilterBar filters={filters} onChange={updateFilters} sites={catalog} readings={readings} />
            <ExportBar rows={ledgerRows} focusLabel={focus?.label ?? null} filters={filters} scopeLabel={scopeLabel} assessments={assessments} overview={stats} />
          </div>

          <OverviewTiles stats={stats} assessments={assessments} scopeLabel={scopeLabel} />
        </section>

        <section id="priority" className={styles.section} aria-labelledby="priority-title">
          <div className={styles.sectionHead}>
            <h2 id="priority-title">Site screening</h2>
            <p>Ranked by the rules in <a href="#method">Method</a>. Uses the site, year, festival and phase filters. Parameter and search filters only narrow the evidence.</p>
          </div>
          <div className={styles.priorityGrid}>
            <PriorityTable assessments={assessments} selectedId={activeSite?.siteId ?? null} onSelect={setSelected} />
            {activeSite ? (
              <SitePanel key={`${activeSite.siteId}|${filtersToSearch({ ...filters, parameter: "all", q: "" })}`} assessment={activeSite} filters={filters} onShowEvidence={showEvidence} aiAvailable={props.aiAvailable} />
            ) : (
              <div className={styles.empty}>No sites match the current filters.</div>
            )}
          </div>
        </section>

        <section id="trends" className={styles.section} aria-labelledby="trends-title">
          <div className={styles.sectionHead}>
            <h2 id="trends-title">Readings by festival and phase</h2>
            <p>Each mark is one printed reading. Lines join phases within a single festival only, never across gaps or between different festivals.</p>
          </div>
          <EventProfile readings={scoped} universe={universe} sites={assessments.map((a) => ({ siteId: a.siteId, site: a.site }))} parameter={effectiveChartParam} onParameterChange={setChartParam} parameterLocked={filters.parameter !== "all"} />
          <div className={styles.twoUp}>
            <PhaseComparison readings={scoped} parameter={effectiveChartParam} />
            <CoverageMatrix readings={scoped} universe={universe} assessments={assessments} />
          </div>
        </section>

        <section id="evidence" className={styles.section} aria-labelledby="evidence-title">
          <div className={styles.sectionHead}>
            <h2 id="evidence-title">Evidence ledger</h2>
            <p>Every reading behind the figures above, with the value exactly as printed and a link to the report page.</p>
          </div>
          <EvidenceLedger key={`${filtersToSearch(filters)}|${focus?.label ?? ""}`} rows={ledgerRows} focus={focus} onClearFocus={() => setFocus(null)} />
        </section>

        <section id="method" className={styles.section} aria-labelledby="method-title">
          <MethodSection issues={props.issues} rowsRead={props.rowsRead} readingsLoaded={readings.length} verificationMethod={props.verificationMethod} verificationCheckedOn={props.verificationCheckedOn} tables={tableCheck} />
        </section>
      </main>

      <footer className={styles.footer}>
        <p>
          Data: MPPCB Ganesh and Durga immersion reports 2023–2025, as extracted in the Bhopal Impact Lab 2026 dataset. Benchmarks: CPCB
          water-quality criteria, Class B. This page collects no personal data and sets no cookies.
        </p>
      </footer>
    </>
  );
}
