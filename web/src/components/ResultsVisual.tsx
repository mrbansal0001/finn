"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResultsFacts } from "@/lib/types";
import { marginPlot } from "@/lib/investigate";
import { MarginDots } from "./MarginDots";

type Vals = Record<string, number | null | undefined>;
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr1 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const cr = (v: number) => `${v < 0 ? "−" : ""}₹${Math.abs(v) < 100 ? inr1.format(Math.abs(v)) : inr.format(Math.abs(v))} cr`;
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

/** "Q2 FY27" for a period end; shifted back by a year or a quarter for the comparison. */
function quarter(iso: string, back = 0): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - back);
  const m = d.getUTCMonth() + 1, y = d.getUTCFullYear();
  const fy = m >= 4 ? y + 1 : y;
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 ? 3 : 4;
  return `Q${q} FY${String(fy).slice(2)}`;
}

/**
 * Is growth turning into comparable profitability? (visual review §8)
 * Growth: each metric's current period against one comparison period, YoY or QoQ (never mixed), as two bars
 * on that metric's own zero-based scale. Margins: the existing dot plot. Tap a metric for its filed figures.
 * The exact table stays below; the chart doesn't replace it.
 */
export function ResultsVisual({ r, question }: { r: ResultsFacts; question?: { text: string; href: string } }) {
  const c = r.comparatives as (ResultsFacts["comparatives"] & { prev_y?: Vals; prev_q?: Vals }) | null;
  const margin = marginPlot(r);
  const [view, setView] = useState<"growth" | "margins">("growth");
  const halfYearly = r.reporting === "Half Yearly";
  const [cmp, setCmp] = useState<"yoy" | "qoq">("yoy");
  const [focus, setFocus] = useState<string | null>(null);
  if (!c) return null;
  const prior = cmp === "yoy" ? c.prev_y : c.prev_q;
  const metrics: [string, string][] = c.is_bank
    ? [["nii", "Net interest income"], ["ppop", "Operating profit"], ["provisions", "Provisions"], ["pat", "PAT"]]
    : [["revenue", "Revenue"], ...(c.is_lender ? [] : [["ebitda", "EBITDA"] as [string, string]]), ["pbt", "PBT"], ["pat", "PAT"]];
  const rows = metrics
    .map(([k, label]) => ({ k, label, now: c.current[k] as number | null | undefined, then: prior?.[k] }))
    .filter((x): x is { k: string; label: string; now: number; then: number } => x.now != null && x.then != null);
  const nowQ = quarter(r.period_end), thenQ = quarter(r.period_end, cmp === "yoy" ? 12 : 3);
  const sel = rows.find((x) => x.k === focus);

  return (
    <figure className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Chart">
          {(["growth", "margins"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              disabled={v === "margins" && !margin}
              onClick={() => setView(v)}
              className={`min-h-[40px] rounded-full px-3.5 text-small disabled:opacity-40 ${view === v ? "bg-ink font-medium text-paper" : "border border-rule text-ink-2"}`}
            >
              {v === "growth" ? "Growth" : "Margins"}
            </button>
          ))}
        </div>
        {view === "growth" && (
          <div className="flex gap-1" role="group" aria-label="Compared with">
            {(["yoy", "qoq"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={cmp === v}
                disabled={v === "qoq" && (halfYearly || !c.prev_q)}
                onClick={() => setCmp(v)}
                className={`min-h-[40px] rounded-full px-3 text-caption disabled:opacity-40 ${cmp === v ? "bg-tint font-medium text-ink ring-1 ring-ink-3" : "text-ink-2"}`}
              >
                {v === "yoy" ? "vs a year ago" : "vs last quarter"}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "margins" && margin ? (
        <MarginDots m={margin} />
      ) : (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
            {rows.map((m) => {
              const top = Math.max(Math.abs(m.now), Math.abs(m.then)) || 1;
              const g = m.then ? ((m.now - m.then) / Math.abs(m.then)) * 100 : null;
              return (
                <li key={m.k}>
                  <button
                    onClick={() => setFocus(focus === m.k ? null : m.k)}
                    aria-pressed={focus === m.k}
                    aria-label={`${m.label}: ${cr(m.now)} in ${nowQ} against ${cr(m.then)} in ${thenQ}`}
                    className={`block w-full rounded-lg px-2 py-1.5 text-left ${focus === m.k ? "bg-tint ring-1 ring-ink-3" : ""}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-caption text-ink-2">{m.label}</span>
                      <span className="num text-caption font-medium text-ink">{g != null && (m.now >= 0) === (m.then >= 0) ? signed(g) : ""}</span>
                    </span>
                    {/* two bars on this metric's own scale, from zero; a loss is outlined, not a negative bar */}
                    {[
                      { v: m.then, cls: "bg-ink-3/40", lab: thenQ },
                      { v: m.now, cls: "bg-ink", lab: nowQ },
                    ].map((b) => (
                      <span key={b.lab} className="mt-1 flex items-center gap-1.5">
                        <span className="relative h-2.5 flex-1 rounded-sm bg-tint">
                          <span
                            className={`absolute inset-y-0 left-0 rounded-sm ${b.v < 0 ? "border border-ink-2 bg-paper" : b.cls}`}
                            style={{ width: `${Math.max(2, (100 * Math.abs(b.v)) / top)}%` }}
                          />
                        </span>
                      </span>
                    ))}
                    <span className="num mt-1 flex justify-between text-label text-ink-3">
                      <span>{cr(m.then)}</span>
                      <span className="text-ink-2">{cr(m.now)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex items-center gap-3 text-caption text-ink-3">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className="inline-block h-2 w-3 rounded-sm bg-ink-3/40" /> {thenQ}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className="inline-block h-2 w-3 rounded-sm bg-ink" /> {nowQ}
            </span>
            <span>Each metric on its own scale, from zero.</span>
          </p>
          {sel && (
            <p className="mt-2 rounded-lg bg-tint px-3.5 py-2.5 text-small text-ink-2" aria-live="polite">
              <span className="font-medium text-ink">{sel.label}</span>: {cr(sel.now)} in {nowQ} against {cr(sel.then)} in {thenQ}. {r.nature}, ₹ crore, as filed
              {sel.k === "pbt" && c.current.exceptional ? `; includes a ${cr(c.current.exceptional as number)} exceptional item before tax` : ""}
              {sel.k === "pat" && c.current.exceptional ? "; the exceptional item's tax effect isn't stated, so PAT isn't adjusted" : ""}.
              {r.source_url && (
                <>
                  {" "}
                  <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="tap text-accent">
                    Source ↗
                  </a>
                </>
              )}
            </p>
          )}
        </>
      )}
      {question && (
        <Link href={question.href} className="mt-3 flex items-start gap-2 rounded-lg border border-rule px-3.5 py-3 text-small text-ink hover:bg-tint">
          <span className="min-w-0 flex-1">{question.text}</span>
          <span className="shrink-0 font-medium text-accent">Investigate ›</span>
        </Link>
      )}
    </figure>
  );
}
