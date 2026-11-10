// Every number gets a unit and a period (anti-slop rule 4). Indian conventions:
// ₹ crore with Indian digit grouping, margins in basis points, FY = Apr–Mar.

const IST = "Asia/Kolkata";
const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

export function crore(rupees: number | null | undefined): string {
  if (rupees == null || Number.isNaN(rupees)) return "–";
  const cr = rupees / 1e7;
  return `₹${Math.abs(cr) < 100 ? inr1.format(cr) : inr.format(cr)} cr`;
}

export function croreFromCr(cr: number | null | undefined): string {
  if (cr == null || Number.isNaN(cr)) return "–";
  return `₹${Math.abs(cr) < 100 ? inr1.format(cr) : inr.format(cr)} cr`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "–";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

export function bp(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(v))}bp`;
}

export function arrow(v: number | null | undefined): string {
  if (v == null || v === 0) return "";
  return v > 0 ? "▲" : "▼";
}

export function dirClass(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-ink-2";
  return v > 0 ? "text-up" : "text-down";
}

/** "07:41" if same day as `ref`, "Thu 05 Nov" otherwise. Always absolute (rule 5). */
export function when(iso: string, ref?: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}+05:30`);
  const r = ref ? new Date(ref.endsWith("Z") || ref.includes("+") ? ref : `${ref}+05:30`) : null;
  const day = d.toLocaleDateString("en-GB", { timeZone: IST, weekday: "short", day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" });
  if (r) {
    const rd = r.toLocaleDateString("en-GB", { timeZone: IST, day: "2-digit", month: "short" });
    if (rd === d.toLocaleDateString("en-GB", { timeZone: IST, day: "2-digit", month: "short" })) return time;
  }
  return `${day} · ${time}`;
}

export function longDate(iso: string): string {
  const d = new Date(iso.includes("+") || iso.endsWith("Z") ? iso : `${iso}+05:30`);
  return d.toLocaleDateString("en-GB", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
}

/** '2026-09-30' -> 'Q2 FY27' */
export function fyQuarter(periodEnd: string): string {
  const y = Number(periodEnd.slice(0, 4));
  const m = Number(periodEnd.slice(5, 7));
  const q = ({ 6: 1, 9: 2, 12: 3, 3: 4 } as Record<number, number>)[m] ?? 0;
  const fy = m >= 4 ? y + 1 : y;
  return `Q${q} FY${String(fy % 100).padStart(2, "0")}`;
}

export const KIND_LABEL: Record<string, string> = {
  results: "Results",
  management_change: "People",
  m_and_a: "Deal",
  litigation: "Legal",
  move: "Move",
  credit_rating: "Rating",
  fund_raise: "Capital",
  capex: "Orders & capex",
  press_release: "Release",
  earnings_call: "Call",
  dividend: "Dividend",
  bonus_split: "Bonus/split",
  insider_trading: "Insider",
  pledging: "Pledge",
  unclassified: "Filing",
};
