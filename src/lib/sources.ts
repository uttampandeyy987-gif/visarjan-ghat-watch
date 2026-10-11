import type { SourceId } from "./types";

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  pages?: number;
  /** What was actually done with this source in this project. */
  use: string;
}

export const REPORTS: Record<SourceId, Source & { year: number }> = {
  "mppcb-visarjan-2023": {
    id: "mppcb-visarjan-2023",
    year: 2023,
    title: "Idol Immersion Report 2023 (CPCB format)",
    publisher: "Madhya Pradesh Pollution Control Board",
    url: "https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf",
    pages: 87,
    use: "Primary source. Every Bhopal ghat table cited by the dataset was compared cell by cell with the PDF text layer.",
  },
  "mppcb-visarjan-2024": {
    id: "mppcb-visarjan-2024",
    year: 2024,
    title: "Ganesh and Durga Visarjan Report 2024",
    publisher: "Madhya Pradesh Pollution Control Board",
    url: "https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf",
    pages: 118,
    use: "Primary source. Every Bhopal ghat table cited by the dataset was compared cell by cell with the PDF text layer.",
  },
  "mppcb-visarjan-2025": {
    id: "mppcb-visarjan-2025",
    year: 2025,
    title: "Ganesh and Durga Visarjan Report 2025",
    publisher: "Madhya Pradesh Pollution Control Board",
    url: "https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf",
    pages: 92,
    use: "Primary source. Every Bhopal ghat table cited by the dataset was compared cell by cell with the PDF text layer.",
  },
};

export function reportForYear(year: number): SourceId {
  const id = `mppcb-visarjan-${year}` as SourceId;
  if (!(id in REPORTS)) throw new Error(`No report registered for ${year}`);
  return id;
}

/** Opens the PDF at the cited page in browsers whose viewer supports #page. */
export function pageUrl(sourceId: SourceId, page: number): string {
  return `${REPORTS[sourceId].url}#page=${page}`;
}

export const DATASET_SOURCE: Source = {
  id: "hackathon-dataset",
  title: "bhopal_ghats_2023_2025.csv — Bhopal Impact Lab 2026, Track 02",
  publisher: "Laaaaksh/bhopal-impact-lab-2026 (GitHub)",
  url: "https://github.com/Laaaaksh/bhopal-impact-lab-2026/tree/main/tracks/02-visarjan-ghat-watch/data",
  use: "The dataset this tool loads: 1,524 readings at 7 Bhopal ghats, extracted from the three MPPCB reports above.",
};

export const STANDARD_SOURCE: Source = {
  id: "cpcb-criteria",
  title: "Water Quality Criteria (designated best use)",
  publisher: "Central Pollution Control Board",
  url: "https://cpcb.gov.in/water-quality-criteria/",
  use: "Class B (organised outdoor bathing) limits for pH, DO and BOD. Read 11 Oct 2026; page shows ‘Updated on 11 Oct 2019’.",
};

export const CONTEXT_SOURCES: Source[] = [
  {
    id: "fpj-ngt",
    title: "Idol immersion to shift from lakes to safer sites; NGT ban pushes BMC to build 4 dedicated ghats",
    publisher: "Free Press Journal, 26 Feb 2026",
    url: "https://www.freepressjournal.in/amp/bhopal/mp-news-idol-immersion-to-shift-from-lakes-to-safer-sites-ngt-ban-pushes-bmc-to-build-4-dedicated-ghats",
    use: "News report, not the order itself: immersion in Upper Lake and Lower Lake prohibited; new ghats at Malikhadi, Barkatullah University campus, Sanjeev Nagar and Neelbadh.",
  },
  {
    id: "drik-2026",
    title: "Durga Visarjan 2026 date",
    publisher: "Drik Panchang",
    url: "https://www.drikpanchang.com/navratri/durga-puja/durga-visarjan-date-time.html?year=2026",
    use: "Durga Visarjan date: Tuesday 20 October 2026. (The page’s muhurat timings are for another city and are not used.)",
  },
];

/** Inspected but deliberately not merged into ghat screening. */
export const EXCLUDED_SOURCES: Source[] = [
  {
    id: "lake-2025-26",
    title: "Upper & Lower Lake monthly water quality 2025–26",
    publisher: "MPPCB (xgn.mp.nic.in)",
    url: "https://xgn.mp.nic.in/File_Upload/MONITORING//Yearly%20Water%20Quality%20Status/2026/July/UPPER%20LAKE-2025-26..pdf",
    use: "Monthly samples at lake intake stations, not at ghats during immersion. BOD is reported as a 3-day, 27 °C test, while CPCB criteria use 5 days at 20 °C. The text layer contains spreadsheet errors (#DIV/0!). Not combined.",
  },
  {
    id: "upper-lake-2023-24",
    title: "Upper Lake water quality 2023–24",
    publisher: "MPPCB",
    url: "https://www.mppcb.mp.gov.in/proc/mon/Bhopal-2023-24_upper_lake.pdf",
    use: "Monthly samples at the Yacht Club intake station, a different sampling context from immersion ghats. Not combined.",
  },
  {
    id: "lake-comparative",
    title: "Upper & Lower Lake station-wise comparison, 2003–04 to 2022–23",
    publisher: "MPPCB",
    url: "https://www.mppcb.mp.gov.in/proc/mon/comparatives-uppe-lak-lower-lake-2003-2023.pdf",
    use: "Long-term monthly station data (112 pages). Different sampling context. Not combined.",
  },
];
