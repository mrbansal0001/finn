import type { Card, Edition } from "./types";
import { pct as fmtPct, times } from "./format";

/** "What counts as material?" -- the investor decides what unusual means (brief, Push). */
export type Prefs = {
  price_pct: number;     // alert when |close-to-close move| >= this
  volume_x: number;      // alert when volume >= this multiple of the 20-session average
  muted: string[];       // card kinds folded into routine
  leads: number;         // how many lead items an edition may have
  alert_kinds: string[]; // filings that are alerts the moment they land (brief: "a material announcement of a type I care about")
};

/** The announcement types that can be alerts (brief, Push 2): results, deals, management changes. */
export const ALERT_KINDS: { kind: string; label: string }[] = [
  { kind: "results", label: "Results" },
  { kind: "m_and_a", label: "Deals" },
  { kind: "management_change", label: "Management changes" },
];

export const DEFAULT_PREFS: Prefs = { price_pct: 5, volume_x: 2, muted: [], leads: 3, alert_kinds: ALERT_KINDS.map((k) => k.kind) };
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
      // a cookie from before this setting existed gets the defaults (all three on)
      alert_kinds: Array.isArray(p.alert_kinds)
        ? p.alert_kinds.filter((k) => ALERT_KINDS.some((a) => a.kind === k))
        : DEFAULT_PREFS.alert_kinds,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);

// one settings toggle covers every category it names (audit F05: "Dividends & splits" also mutes bonus/split)
const KIND_ALIASES: Record<string, string[]> = { dividend: ["dividend", "bonus_split"], insider_trading: ["insider_trading", "pledging"] };
const TIER_WEIGHT: Record<string, number> = { lead: 300, notable: 200, routine: 0 };

export type Alert = { card: Card; rules: string[] };

/** The sessions that meet the investor's own rules inside the window, newest first. Every one has its own card. */
export function alertsFor(moveCards: Card[], since: string, until: string, prefs: Prefs): Alert[] {
  const t0 = ist(since), t1 = ist(until);
  const out: Alert[] = [];
  for (const c of moveCards) {
    const t = ist(c.at);
    if (!(t > t0 && t <= t1)) continue;
    const f = c.facts as { change_pct?: number; volume_multiple?: number };
    const pct = f.change_pct ?? 0, vol = f.volume_multiple ?? 0;
    const rules = [
      Math.abs(pct) >= prefs.price_pct ? fmtPct(pct) : null,
      vol >= prefs.volume_x ? `${times(vol)} volume` : null,
    ].filter((x): x is string => x !== null);
    if (rules.length) out.push({ card: c, rules });
  }
  return out.sort((a, b) => b.card.at.localeCompare(a.card.at) || b.card.score - a.card.score);
}

/** Re-rank an edition with the investor's thresholds. Pure; runs on the server.
 *  Rules are applied to every qualifying session first, then grouped: one move card per company (its most
 *  important matching session), with the others counted -- never the other way round (audit F05). */
export function applyPrefs(ed: Edition, prefs: Prefs, moveCards: Card[] = [], holdings?: Set<string>): Edition {
  const muted = new Set(prefs.muted.flatMap((k) => KIND_ALIASES[k] ?? [k]));
  const hits = alertsFor(moveCards, ed.since, ed.until, prefs);
  const bySymbol = new Map<string, Alert[]>();
  for (const h of hits) bySymbol.set(h.card.symbol, [...(bySymbol.get(h.card.symbol) ?? []), h]);
  const moves: Card[] = [];
  for (const group of bySymbol.values()) {
    const priceHit = (h: Alert) => Math.abs((h.card.facts as { change_pct?: number }).change_pct ?? 0) >= prefs.price_pct;
    const rank = (h: Alert) => (priceHit(h) ? 1000 : 0) + Math.abs((h.card.facts as { change_pct?: number }).change_pct ?? 0)
      + ((h.card.facts as { volume_multiple?: number }).volume_multiple ?? 0) / 10;
    const best = [...group].sort((a, b) => rank(b) - rank(a))[0];
    const c: Card = structuredClone(best.card);
    const explained = (c.facts as { explained_by?: string | null }).explained_by;
    // a research-list company is shown, never a lead: the edition is about the holdings first (three-pillars P1)
    const tier = priceHit(best) && !explained && (!holdings || holdings.has(c.symbol)) ? "lead" : "notable";
    c.score = c.score - TIER_WEIGHT[c.tier] + TIER_WEIGHT[tier];   // the score follows the re-tiering
    c.tier = tier;
    c.facts = { ...c.facts, matched: best.rules, other_sessions: group.length - 1 };
    moves.push(c);
  }
  // editions exported before the move registry still carry their own move cards
  const legacy = moveCards.length ? [] : [...ed.leads, ...ed.more].filter((c) => c.kind === "move");
  let folded = 0;
  const kept: Card[] = [];
  const mutedCards: Card[] = [];
  for (const c of [...ed.leads, ...ed.more].filter((c) => c.kind !== "move").concat(moves, legacy)) {
    if (muted.has(c.kind)) {
      folded++;
      mutedCards.push(c);
      continue;
    }
    kept.push(c);
  }
  kept.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const leads = kept.filter((c) => c.tier === "lead").slice(0, prefs.leads);
  const more = kept.filter((c) => !leads.includes(c));
  const routine: [string, number][] = folded ? [...ed.routine, ["Muted by you", folded]] : ed.routine;
  return { ...ed, leads, more, routine, routine_total: ed.routine_total + folded, muted: mutedCards };
}

/** Export timestamps carry no offset and are IST. */
export const ist = (s: string) => Date.parse(/[+Z]/.test(s.slice(10)) ? s : `${s}+05:30`);

/** Filings of the kinds the investor asked to be alerted about, for their holdings, newest first (brief, Push 2). */
export function filedAlertsFor(cards: Card[], prefs: Prefs, holdings: Set<string>): Card[] {
  const kinds = new Set(prefs.alert_kinds);
  return cards.filter((c) => kinds.has(c.kind) && holdings.has(c.symbol)).sort((a, b) => b.at.localeCompare(a.at));
}
