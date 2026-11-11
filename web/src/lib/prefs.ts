import type { Card, Edition } from "./types";

/** "What counts as material?" -- the investor decides what unusual means (brief, Push). */
export type Prefs = {
  price_pct: number;     // alert when |close-to-close move| >= this
  volume_x: number;      // alert when volume >= this multiple of the 20-session average
  muted: string[];       // card kinds folded into routine
  leads: number;         // how many lead items an edition may have
};

export const DEFAULT_PREFS: Prefs = { price_pct: 5, volume_x: 2, muted: [], leads: 3 };
export const PREFS_COOKIE = "finn_prefs";

export const KIND_CHOICES: { kind: string; label: string; hint: string }[] = [
  { kind: "results", label: "Results", hint: "Quarterly numbers" },
  { kind: "management_change", label: "People", hint: "Directors, KMP, senior management" },
  { kind: "m_and_a", label: "Deals", hint: "Acquisitions, mergers, schemes" },
  { kind: "litigation", label: "Legal & regulatory", hint: "Disputes, orders, forensic audits, defaults" },
  { kind: "credit_rating", label: "Credit ratings", hint: "New, revised, withdrawn" },
  { kind: "fund_raise", label: "Capital raising", hint: "QIPs, preferentials, allotments" },
  { kind: "capex", label: "Orders & capex", hint: "Order wins, capacity, launches" },
  { kind: "earnings_call", label: "Earnings calls", hint: "Transcripts and recordings" },
  { kind: "press_release", label: "Press releases", hint: "Company announcements" },
  { kind: "dividend", label: "Dividends & splits", hint: "Payouts, bonuses, splits" },
  { kind: "insider_trading", label: "Insider trades & pledges", hint: "Promoter buying, selling, pledging" },
  { kind: "move", label: "Price & volume moves", hint: "Uses the thresholds above" },
];

export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      price_pct: clamp(Number(p.price_pct ?? DEFAULT_PREFS.price_pct), 1, 20),
      volume_x: clamp(Number(p.volume_x ?? DEFAULT_PREFS.volume_x), 1.2, 10),
      muted: Array.isArray(p.muted) ? p.muted.filter((k) => typeof k === "string").slice(0, 20) : [],
      leads: clamp(Math.round(Number(p.leads ?? 3)), 1, 5),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

/** Re-rank an edition with the investor's thresholds. Pure; runs on the server. */
export function applyPrefs(ed: Edition, prefs: Prefs): Edition {
  const all = [...ed.leads, ...ed.more];
  let folded = 0;
  const kept: Card[] = [];
  for (const c of all) {
    if (c.kind === "move") {
      const f = c.facts as { change_pct?: number; volume_multiple?: number; explained_by?: string | null };
      const priceHit = Math.abs(f.change_pct ?? 0) >= prefs.price_pct;
      const volHit = (f.volume_multiple ?? 0) >= prefs.volume_x;
      if (!priceHit && !volHit) continue; // below the investor's own bar: not news
      // an explained move is already told on its filing's card; only an unexplained one leads
      c.tier = priceHit && !f.explained_by ? "lead" : "notable";
    }
    if (prefs.muted.includes(c.kind)) {
      folded++;
      continue;
    }
    kept.push(c);
  }
  kept.sort((a, b) => b.score - a.score || (a.tier === "lead" ? -1 : 1));
  const leads = kept.filter((c) => c.tier === "lead").slice(0, prefs.leads);
  const more = kept.filter((c) => !leads.includes(c));
  const routine: [string, number][] = folded ? [...ed.routine, ["Muted by you", folded]] : ed.routine;
  return { ...ed, leads, more, routine, routine_total: ed.routine_total + folded };
}
