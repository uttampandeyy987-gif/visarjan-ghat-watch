import type { ParameterId } from "./types";

export interface Benchmark {
  kind: "min" | "max" | "range";
  min?: number;
  max?: number;
  /** Human-readable rule, e.g. "≥ 5 mg/L". */
  label: string;
}

export interface ParameterInfo {
  id: ParameterId;
  name: string;
  short: string;
  unit: string | null;
  plain: string;
  /** CPCB Class B (organised outdoor bathing). Only set where CPCB defines one. */
  classB: Benchmark | null;
}

/**
 * CPCB designated-best-use criteria, Class B "Organised outdoor bathing":
 * pH 6.5–8.5, DO ≥ 5 mg/L, BOD (5 days, 20 °C) ≤ 3 mg/L.
 * Source: https://cpcb.gov.in/water-quality-criteria/ (read 11 Oct 2026; page dated 11 Oct 2019).
 * CPCB sets no Class B limit for the other parameters, so none is invented here.
 */
export const PARAMETERS: readonly ParameterInfo[] = [
  { id: "do", name: "Dissolved oxygen", short: "DO", unit: "mg/L", plain: "Oxygen available in the water.", classB: { kind: "min", min: 5, label: "≥ 5 mg/L" } },
  { id: "bod", name: "BOD", short: "BOD", unit: "mg/L", plain: "Oxygen consumed by decomposing organic matter.", classB: { kind: "max", max: 3, label: "≤ 3 mg/L" } },
  { id: "ph", name: "pH", short: "pH", unit: null, plain: "Acidity or alkalinity; 7 is neutral.", classB: { kind: "range", min: 6.5, max: 8.5, label: "6.5–8.5" } },
  { id: "cod", name: "COD", short: "COD", unit: "mg/L", plain: "Total oxygen-demanding material, organic and inorganic.", classB: null },
  { id: "total-solids", name: "Total solids", short: "TS", unit: "mg/L", plain: "Everything left after the water evaporates.", classB: null },
  { id: "dissolved-solids", name: "Dissolved solids", short: "TDS", unit: "mg/L", plain: "Solids dissolved in the water.", classB: null },
  { id: "suspended-solids", name: "Suspended solids", short: "TSS", unit: "mg/L", plain: "Particles suspended in the water. Not tested for every festival.", classB: null },
  { id: "turbidity", name: "Turbidity", short: "Turb.", unit: "NTU", plain: "Cloudiness of the water.", classB: null },
  { id: "conductivity", name: "Conductivity", short: "EC", unit: "µS/cm", plain: "Dissolved salts. CPCB caps it only for Class E (irrigation), at 2,250.", classB: null },
  { id: "chromium", name: "Chromium", short: "Cr", unit: "mg/L", plain: "Heavy metal; can come from paints and pigments.", classB: null },
  { id: "lead", name: "Lead", short: "Pb", unit: "mg/L", plain: "Heavy metal; can come from paints and pigments.", classB: null },
  { id: "zinc", name: "Zinc", short: "Zn", unit: "mg/L", plain: "Heavy metal; can come from paints and pigments.", classB: null },
  { id: "copper", name: "Copper", short: "Cu", unit: "mg/L", plain: "Heavy metal; can come from paints and pigments.", classB: null },
];

const BY_ID = new Map(PARAMETERS.map((p) => [p.id, p]));
const BY_NAME = new Map(PARAMETERS.map((p) => [p.name.toLowerCase(), p]));

export function parameterById(id: ParameterId): ParameterInfo {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown parameter id ${id}`);
  return p;
}

export function parameterByName(name: string): ParameterInfo | undefined {
  return BY_NAME.get(name.trim().toLowerCase());
}

export function isParameterId(v: string): v is ParameterId {
  return BY_ID.has(v as ParameterId);
}

/** true = fails the Class B benchmark, false = within it, null = no benchmark or no number. */
export function failsClassB(id: ParameterId, value: number | null): boolean | null {
  const b = BY_ID.get(id)?.classB;
  if (!b || value === null) return null;
  if (b.kind === "min") return value < (b.min as number);
  if (b.kind === "max") return value > (b.max as number);
  return value < (b.min as number) || value > (b.max as number);
}

export const SCREENED_PARAMETERS: readonly ParameterId[] = ["do", "bod", "ph"];
