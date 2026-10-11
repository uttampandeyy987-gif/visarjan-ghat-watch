import fs from "node:fs";
import path from "node:path";
import { parseDataset, type VerificationFile } from "@/lib/dataset";

const dir = path.resolve(__dirname, "..", "data");
export const CSV = fs.readFileSync(path.join(dir, "bhopal_ghats_2023_2025.csv"), "utf8");
export const VERIFICATION = JSON.parse(fs.readFileSync(path.join(dir, "verification.json"), "utf8")) as VerificationFile;
export const dataset = parseDataset(CSV, VERIFICATION);

export const HEADER = CSV.split(/\r?\n/)[0];
export const NO_VERIFICATION: VerificationFile = { method: "none", checkedOn: "never", tables: [] };
