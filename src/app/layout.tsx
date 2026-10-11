import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Ghat Watch — Bhopal immersion-ghat water quality, 2023–2025",
  description:
    "Historical MPPCB water-quality readings at seven Bhopal immersion ghats, screened against CPCB Class B bathing criteria, with every finding traced to its report page.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0f3d3b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
