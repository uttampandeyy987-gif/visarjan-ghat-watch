import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseDataset, type VerificationFile } from "../dataset";
import type { Dataset } from "../types";

let cached: Dataset | null = null;

/** Loads the bundled dataset once per server instance. Fixed paths only — nothing user-controlled reaches the filesystem. */
export function loadDataset(): Dataset {
  if (cached) return cached;
  const dir = path.join(process.cwd(), "data");
  const csv = fs.readFileSync(path.join(dir, "bhopal_ghats_2023_2025.csv"), "utf8");
  const verification = JSON.parse(fs.readFileSync(path.join(dir, "verification.json"), "utf8")) as VerificationFile;
  cached = parseDataset(csv, verification);
  return cached;
}
