"use client";

import { useState } from "react";
import type { ExplainResponse } from "@/lib/explain";
import type { SiteAssessment } from "@/lib/screening";
import type { Filters } from "@/lib/types";
import styles from "./AiExplain.module.css";
import { KindTag } from "./Badges";

type State = { status: "idle" } | { status: "loading" } | { status: "done"; data: ExplainResponse } | { status: "error"; message: string };

export default function AiExplain({ assessment, filters, aiAvailable }: { assessment: SiteAssessment; filters: Filters; aiAvailable: boolean }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function run() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: assessment.siteId, year: filters.year, festival: filters.festival, phase: filters.phase }),
      });
      const data = (await res.json().catch(() => null)) as ExplainResponse | { error: string } | null;
      if (data && "mode" in data) setState({ status: "done", data });
      else setState({ status: "error", message: (data && "error" in data && data.error) || `Request failed (${res.status}).` });
    } catch {
      setState({ status: "error", message: "The explanation service could not be reached. Everything else on this page still works." });
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h4>Plain-English explanation</h4>
          <p>{aiAvailable ? "Drafted by Claude from the calculated findings above, then checked against them." : "Claude is not configured here, so an automatic summary is shown."}</p>
        </div>
        <button type="button" className={styles.btn} onClick={run} disabled={state.status === "loading"} aria-busy={state.status === "loading"}>
          {state.status === "loading" ? "Drafting…" : state.status === "done" ? "Redraft" : aiAvailable ? "Draft with Claude" : "Show summary"}
        </button>
      </div>

      <div aria-live="polite">
        {state.status === "loading" && <p className={styles.pending}>Sending only the calculated findings for this site and view…</p>}
        {state.status === "error" && <p className={styles.error} role="alert">{state.message}</p>}
        {state.status === "done" && (
          <article className={state.data.mode === "ai" ? styles.ai : styles.auto}>
            <header className={styles.meta}>
              <KindTag kind={state.data.mode === "ai" ? "ai" : "automatic"} />
              <span>
                {state.data.mode === "ai"
                  ? `${state.data.model}${state.data.fallbackUsed ? " (fallback model)" : ""} · ${state.data.view}`
                  : `${state.data.reason} · ${state.data.view}`}
              </span>
            </header>
            {state.data.text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
            {state.data.mode === "ai" && (
              <p className={styles.caution}>AI-generated text can still misstate details. Rely on the figures and the evidence ledger, not on this paragraph.</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
