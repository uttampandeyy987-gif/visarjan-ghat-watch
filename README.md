# Ghat Watch — Visarjan water-quality evidence for Bhopal

A decision-support tool for the Bhopal Municipal Corporation officer planning Durga visarjan (20 October 2026). It lines up three years of MPPCB immersion-monitoring readings (2023–2025, Ganesh and Durga, before / during / one week after immersion) at seven Bhopal ghats. It screens them against the CPCB Class B bathing criteria, ranks the sites with written reasons, and traces every figure back to its report page.

The readings are historical. The tool does not describe current water quality, and its screening is not a regulatory determination.

## What it does

| Feature | Notes |
|---|---|
| **Site screening** | Ranks the 7 ghats into High priority / Elevated / Monitor / Insufficient data with explicit rules (below). Each reason links to the readings behind it. |
| **Completeness, separate from concern** | Coverage bars and a site × festival matrix show what was measured, not sampled, or never published. Gaps are never counted as clean. |
| **Readings by festival and phase** | Small multiples per site on one shared scale, with the Class B band, explicit marks for BDL / not sampled / no table, and a table view of every chart. |
| **Evidence ledger** | Every reading with its normalised value, the value exactly as printed, the assumed unit, the Class B check, and a link that opens the MPPCB PDF at the cited page. |
| **Exports** | CSV of exactly the rows in view (RFC 4180, formula-injection safe). A PDF decision brief with scope, ranking, reasons, method, limitations, an evidence appendix and sources. |
| **Plain-English explanation** | Optional. Claude drafts it from the calculated findings only. The draft is rejected if it cites a page or number not in the evidence, or claims the water is safe. Without an API key, a deterministic summary is shown. |
| **Filters** | Site, year, festival, phase, parameter, and search. The filter state is kept in the URL, so views can be shared. |

No login and no cookies, and no personal data is collected.

## Data

- **Loaded:** `data/bhopal_ghats_2023_2025.csv` from the [Bhopal Impact Lab 2026, Track 02](https://github.com/Laaaaksh/bhopal-impact-lab-2026/tree/main/tracks/02-visarjan-ghat-watch). It holds 1,524 rows: 7 sites, 13 parameters, 2023–2025.
- **Verified:** every row was checked against the three MPPCB reports ([2023](https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf), [2024](https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf), [2025](https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf)). A column-aware script assigned each cell on the cited page to its parameter row and phase column by x/y position. **All 1,524 cells in all 40 tables matched**, including BDL, blank, `_` and `*` codes. A planted-error run confirmed the check catches changed values, changed codes and swapped phases. This was an automated comparison with the PDF text layer, not a human review. `data/verification.json` records the result per table, and the UI shows it on every row.
- **Reproduced:** the PROBLEM.md headline figures (42 of 116 DO readings below 5 mg/L; 100 of 112 BOD readings above 3 mg/L; four 0 mg/L DO readings at Bairagarh).
- **Inspected, not combined:** the Upper/Lower Lake monthly reports. They come from intake-station sampling rather than ghats during immersion, and the 2025–26 file reports BOD as a 3-day, 27 °C test.

### Handling rules

- `BDL` / `ND` → "below detection": no number, never zero, never missing.
- Blank, `_`, `-`, `*`, `**` → not sampled: excluded from counts and never treated as clean.
- A site/festival with no table in the report (Bairagarh and Malikhedi, Durga 2025) counts against coverage.
- Units are assumed (the reports print none) and are labelled as such everywhere.
- *Rani Kamlapati ghat / Kamla Park kund* keeps its medium site-match confidence. Ganesh and Durga tables print different names, so the readings may describe two places. The tool shows both printed names and caps the evidence strength.

## Screening rules

Benchmarks are CPCB Class B (organised outdoor bathing): pH 6.5–8.5, DO ≥ 5 mg/L, BOD ≤ 3 mg/L. CPCB sets no Class B limit for COD, solids, turbidity, conductivity or metals, so none is applied.

The rules run per site, on the measured readings within the site / year / festival / phase filters. The first match wins:

1. **Insufficient data**: fewer than 3 measured DO readings or fewer than 3 measured BOD readings.
2. **High priority**: DO below 5 mg/L in at least 50% of measured DO readings.
3. **Elevated priority**: any DO below 5, any pH outside 6.5–8.5, or BOD above 3 in at least 50% of BOD readings.
4. **Monitor**: none of the above, *and* at least 3 measured pH readings (otherwise Insufficient data). This is explicitly *not* a finding that the water is safe.

A DO reading printed as below detection counts as below the 5 mg/L minimum. BDL BOD and pH readings are left out of the counts, because "below detection" does not establish where they sit against the limit.

Within a category, sites are ordered by DO shortfall share, then lowest DO, then BOD exceedance share. Evidence strength is reported separately (coverage ≥ 90% → Strong, ≥ 60% → Partial, else Thin; a medium site match caps it at Partial). The thresholds live in `src/lib/screening.ts` (`RULES`), and the Method section renders those same constants.

Over the full record, Bairagarh (DO < 5 in 11/13) and Malikhedi (9/13) are High priority, and the other five sites are Elevated.

## Architecture

```
data/                       bundled CSV + per-table verification results
src/lib/                    pure, tested logic shared by UI and server
  dataset.ts                CSV parse + zod validation (invalid rows excluded and reported, never repaired)
  screening.ts              rules, ranking, coverage, reasons with reading ids
  filters.ts                scope/filters, safe query-string parsing
  explain.ts                minimal evidence payload, system prompt, AI output checks, deterministic fallback
  export-csv.ts / export-pdf.ts
  server/                   server-only: dataset loader, AI config, rate limiter
src/app/page.tsx            per-request server render (needed for the CSP nonce)
src/app/api/readings        GET: public read-only JSON of validated readings
src/app/api/explain         POST: optional Claude explanation
src/proxy.ts                per-request nonce Content-Security-Policy
src/components/             dashboard UI; charts are hand-built SVG
```

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), zod, PapaParse, jsPDF + jspdf-autotable, `@anthropic-ai/sdk`, Vitest.

## Security

- **Secrets:** `ANTHROPIC_API_KEY` is read only in server-only modules. The client bundle was scanned and holds no key names and no SDK. `.env*` files are git-ignored; only `.env.example` (placeholders) is tracked.
- **No accounts or admin routes.** The demo is public and read-only by design, and the one cost-bearing endpoint is protected as follows.
- **`POST /api/explain`:**
  - strict zod schema (enumerated values only; no free text reaches the model)
  - 1 KB body limit and JSON content-type required
  - cross-origin requests rejected (`Origin` / `Sec-Fetch-Site`)
  - per-client and global daily rate limits
  - 6-hour response cache, `max_tokens` cap, and a 30 s timeout
  - findings are recomputed server-side, so client-supplied values are never trusted
  - errors are logged as class + status only, never the key or the payload
- **XSS:** all text is rendered as React text, with no `dangerouslySetInnerHTML` anywhere. AI output is plain text, split into paragraphs.
- **Headers:**
  - nonce-based CSP with `strict-dynamic` and no `unsafe-inline` / `unsafe-eval` in production
  - deny-all CSP on API routes
  - `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, `Permissions-Policy`, HSTS, COOP, and no `X-Powered-By`
- **Dependencies:** `npm audit --omit=dev` reports 0 vulnerabilities.

**Residual risks**
- The rate limiter is in memory, so limits apply per serverless instance rather than globally. The daily cap bounds spend per instance. Use a shared store (for example Vercel KV / Upstash) if the endpoint must be strictly bounded.
- The origin check stops browsers on other sites. A scripted client can forge those headers, and only the rate limits apply to it.
- `npm audit` reports a dev-only chain: `braces` ≤ 3.0.3 via the Next ESLint plugin. No patched release exists, and the code is not shipped.
- Automated PDF verification relies on the PDF text layer. A person should still spot-check figures before an official decision.

## Running locally

Requires Node 20+ (tested with Node 24.20).

```bash
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY to enable Claude
npm run dev                    # http://localhost:3000
npm run check                  # typecheck + lint + unit tests
npm run build && npm start     # production build
```

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | No | Enables Claude explanations. Server-side only; never prefix with `NEXT_PUBLIC_`. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-opus-5-5`. If the key cannot use the model, the app shows the automatic summary and names the model in the reason. |
| `AI_RATE_PER_MINUTE` / `AI_RATE_PER_DAY` / `AI_DAILY_CAP` | No | Abuse and cost limits (defaults 4 / 30 / 300). |

## Deploying to Vercel

1. Import the repository in Vercel. It is detected as Next.js, so no `vercel.json` is needed.
2. Optionally add `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`) under *Project Settings → Environment Variables*.
3. Deploy, then check `/`, `/api/readings`, both exports, and "Draft with Claude".

## Testing

- `npm test`: 66 unit tests covering parsing and validation, BDL/missing handling, the headline counts, rule consistency, filters, CSV round-trip and escaping, PDF pagination, AI output checks, rate limiting, and the explain route with a mocked SDK (success, invented page, refusal, bad key, unknown model, rate limit, cache, no key).
- HTTP and real-browser QA (headless Chrome) were run against the production build: CSP nonces, headers, XSS probes, API validation, interactions, exports, mobile layout and keyboard entry, with zero console errors or CSP violations.

## Limits

- Only pH, DO and BOD have Class B limits; other parameters are shown without a pass/fail.
- Only four metals were tested. Nothing is inferred for untested substances.
- The dataset gives no sampling dates within phases, so none are shown.
- An English brief only; the Hindi brief suggested in PROBLEM.md is not implemented.
