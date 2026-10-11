export const PHASES = ["pre", "during", "after"] as const;
export type Phase = (typeof PHASES)[number];

export const FESTIVALS = ["Ganesh", "Durga"] as const;
export type Festival = (typeof FESTIVALS)[number];

/** Codes the reports print instead of a number. */
export const FLAGS = ["BDL", "ND", "not sampled", "*", "**"] as const;
export type Flag = (typeof FLAGS)[number];

/**
 * measured        – a number was printed
 * below-detection – BDL / ND: very low, but NOT zero and NOT missing
 * not-sampled     – blank, "_", "-", "*", "**": missing, never "clean"
 */
export type ValueStatus = "measured" | "below-detection" | "not-sampled";

export type ParameterId =
  | "ph" | "total-solids" | "dissolved-solids" | "suspended-solids" | "do" | "bod" | "cod"
  | "turbidity" | "conductivity" | "chromium" | "lead" | "zinc" | "copper";

export type SourceId = "mppcb-visarjan-2023" | "mppcb-visarjan-2024" | "mppcb-visarjan-2025";

export type VerificationStatus = "auto-checked" | "unverified";

export interface Reading {
  /** Stable id: year-festival-site-phase-parameter */
  id: string;
  year: number;
  festival: Festival;
  siteId: string;
  site: string;
  waterBody: string;
  phase: Phase;
  parameterId: ParameterId;
  parameter: string;
  value: number | null;
  status: ValueStatus;
  flag: Flag | null;
  /** The reports print no units; every unit is an assumption from the data dictionary. */
  unitAssumed: string | null;
  valueAsPrinted: string;
  parameterAsPrinted: string;
  siteAsPrinted: string;
  siteMatchConfidence: "high" | "medium";
  sourceId: SourceId;
  sourcePage: number;
  verification: VerificationStatus;
}

export interface DatasetIssue {
  row: number;
  message: string;
}

export interface Dataset {
  readings: Reading[];
  issues: DatasetIssue[];
  rowsRead: number;
  verificationMethod: string;
  verificationCheckedOn: string;
}

export interface Filters {
  site: string; // siteId or "all"
  year: number | "all";
  festival: Festival | "all";
  phase: Phase | "all";
  parameter: ParameterId | "all";
  q: string;
}

export const DEFAULT_FILTERS: Filters = {
  site: "all",
  year: "all",
  festival: "all",
  phase: "all",
  parameter: "all",
  q: "",
};
