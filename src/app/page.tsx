import { connection } from "next/server";
import Dashboard from "@/components/Dashboard";
import ErrorPanel from "@/components/ErrorPanel";
import { parseFilters } from "@/lib/filters";
import { daysUntil, DURGA_VISARJAN_2026 } from "@/lib/format";
import { aiConfigured } from "@/lib/server/ai-config";
import { loadDataset } from "@/lib/server/load-dataset";
import type { Dataset } from "@/lib/types";

export default async function Page({ searchParams }: PageProps<"/">) {
  await connection(); // per-request render so the CSP nonce applies

  let ds: Dataset;
  try {
    ds = loadDataset();
  } catch (err) {
    console.error("dataset load failed:", err instanceof Error ? err.message : "unknown error");
    return <ErrorPanel title="The dataset could not be loaded" body="The bundled readings file is missing or unreadable, so nothing can be shown. No figures on this page are estimated or cached." />;
  }
  if (ds.readings.length === 0) {
    return <ErrorPanel title="The dataset contains no valid readings" body={`${ds.issues.length} validation problems were found. Rows are excluded rather than repaired, so the dashboard has nothing it can show.`} />;
  }

  const sp = await searchParams;
  const initialFilters = parseFilters(sp, {
    siteIds: new Set(ds.readings.map((r) => r.siteId)),
    years: new Set(ds.readings.map((r) => r.year)),
  });

  return (
    <Dashboard
      readings={ds.readings}
      issues={ds.issues}
      rowsRead={ds.rowsRead}
      verificationMethod={ds.verificationMethod}
      verificationCheckedOn={ds.verificationCheckedOn}
      initialFilters={initialFilters}
      daysToVisarjan={daysUntil(DURGA_VISARJAN_2026, new Date())}
      aiAvailable={aiConfigured()}
    />
  );
}
