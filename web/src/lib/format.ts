// One rule per kind of number (docs/UI-DESIGN-PLAN-2026-11-12.md §5). Indian conventions: ₹ crore with
// lakh/crore digit grouping, margins in basis points, FY = Apr–Mar, IST times. The minus is always the
// true minus sign (U+2212). Direction is carried by the sign; colour only helps.

const IST = "Asia/Kolkata";
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inr1 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MINUS = "−";

/** ₹ crore from a value in crore: `₹7,328 cr`, `₹50.9 cr`, `₹2,40,357 cr`, `−₹122 cr`. */
export function croreFromCr(cr: number | null | undefined): string {
  if (cr == null || Number.isNaN(cr)) return "–";
  const a = Math.abs(cr);
  return `${cr < 0 ? MINUS : ""}₹${a < 100 ? inr1.format(a) : inr0.format(a)} cr`;
}

/** ₹ crore from a value in rupees. */
export function crore(rupees: number | null | undefined): string {
  return rupees == null || Number.isNaN(rupees) ? "–" : croreFromCr(rupees / 1e7);
}

/** A share price: always two decimals, `₹1,061.20`. */
export function price(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "–" : `₹${inr2.format(v)}`;
}

/** A change in %: sign, one decimal, `+31.4%` `−2.5%` `0.0%`. */
export function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–";
  const r = Math.round(v * 10) / 10;
  const sign = r > 0 ? "+" : r < 0 ? MINUS : "";
  return `${sign}${Math.abs(r).toFixed(1)}%`;
}

/** A margin change in basis points: `−154bp` `+27bp`. */
export function bp(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "–";
  const r = Math.round(v);
  const sign = r > 0 ? "+" : r < 0 ? MINUS : "";
  return `${sign}${Math.abs(r)}bp`;
}

/** A volume multiple: `2.0×`. */
export function times(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "–" : `${v.toFixed(1)}×`;
}

/** Colour class for a direction figure (zero and missing read as neutral ink). */
export function dirClass(v: number | null | undefined): string {
  if (v == null || Math.round(v * 10) === 0) return "text-ink-2";
  return v > 0 ? "text-up" : "text-down";
}

const asDate = (iso: string) => new Date(/[+Z]/.test(iso.slice(10)) ? iso : `${iso}+05:30`);
const ymd = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: IST, year: "numeric", month: "2-digit", day: "2-digit" });

/** "Wed 11 Nov" (adding the year when it isn't `ref`'s year). */
export function day(iso: string, ref?: string): string {
  const d = asDate(iso);
  const r = ref ? asDate(ref) : new Date();
  const sameYear = d.toLocaleDateString("en-GB", { timeZone: IST, year: "numeric" }) === r.toLocaleDateString("en-GB", { timeZone: IST, year: "numeric" });
  return d.toLocaleDateString("en-GB", { timeZone: IST, weekday: "short", day: "2-digit", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "15:30" if the same day as `ref`, otherwise "Wed 11 Nov · 15:30". Always absolute, always IST. */
export function when(iso: string, ref?: string): string {
  const d = asDate(iso);
  const time = d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" });
  if (ref && ymd(d) === ymd(asDate(ref))) return time;
  return `${day(iso, ref)} · ${time}`;
}

/** "11 Nov 12:07": the start of an edition window. */
export function since(iso: string): string {
  const d = asDate(iso);
  const date = d.toLocaleDateString("en-GB", { timeZone: IST, day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: IST, hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

/** "Thu 12 Nov" for the masthead. */
export function longDate(iso: string): string {
  return asDate(iso).toLocaleDateString("en-GB", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
}

/** "11 Nov" for compact rows. */
export function shortDay(iso: string): string {
  return asDate(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-GB", { timeZone: IST, day: "numeric", month: "short" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 2026": a month, never "8 wk ago" (relative times age badly; plan §5). Fixed names: some locales say "Sept". */
export function monthYear(iso: string): string {
  const d = asDate(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const [m, y] = d.toLocaleDateString("en-GB", { timeZone: IST, month: "numeric", year: "numeric" }).split("/");
  return `${MONTHS[Number(m) - 1]} ${y}`;
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
