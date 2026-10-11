import { applyFilters, parseFilters } from "@/lib/filters";
import { loadDataset } from "@/lib/server/load-dataset";

export const runtime = "nodejs";

/**
 * Public, read-only JSON of the validated readings.
 * Accepts the same query parameters as the dashboard (site, year, festival, phase, parameter, q);
 * unknown values are ignored rather than echoed back.
 */
export async function GET(req: Request) {
  try {
    const ds = loadDataset();
    const url = new URL(req.url);
    const params = Object.fromEntries([...url.searchParams.entries()].slice(0, 10));
    const filters = parseFilters(params, { siteIds: new Set(ds.readings.map((r) => r.siteId)), years: new Set(ds.readings.map((r) => r.year)) });
    const readings = applyFilters(ds.readings, filters);
    return Response.json(
      {
        filters,
        count: readings.length,
        rowsRead: ds.rowsRead,
        excludedRows: ds.issues.length,
        notes: [
          "Historical MPPCB immersion readings, 2023-2025. Not current water quality.",
          "value is null for below-detection and not-sampled cells; see status and value_as_printed.",
          "Units are assumed; the reports print none.",
        ],
        readings,
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
    );
  } catch (err) {
    console.error("readings: dataset load failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "Dataset unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
