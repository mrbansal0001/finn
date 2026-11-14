import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SUPABASE_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";

// "Ask the documents" (brief-check plan, part 5). A question about one company is answered only with that
// company's own words: passages from its last four call transcripts and its annual report's MD&A, found by
// full-text search (Postgres in production, the same rules in code for local development). No model reads
// or writes the answer, so nothing outside the documents can leak in, and "the documents don't say" is a
// real answer when no passage covers the question.

export type AskSource = { label: string; url: string; n: number };
export type AskHit = {
  i: number;
  source: AskSource;
  page: number;
  who: string | null;
  role: "m" | "a" | "r" | "";
  /** the passage with the question's words marked as <<word>> */
  snippet: string;
  matched: string[];
  /** the passage's full text, for checking required parts of the question; not sent to the browser */
  body?: string;
  /** source number within the company: an analyst's reply must come from the same document */
  s?: number;
  /** when the best passage is an analyst's question, the company's reply that follows it */
  reply?: { who: string | null; page: number; snippet: string };
};
export type AskResult =
  | { status: "unavailable" }
  | { status: "empty"; sources: AskSource[] }
  | { status: "answer" | "partial" | "none"; terms: string[]; hits: AskHit[]; sources: AskSource[]; missing?: string[] };

// Words that shape a question but don't say what it's about ("what did they say about margins").
const FILLER = new Set(
  ("what did does do they them their say said says saying tell told talk talked talking about mention mentioned comment " +
    "commented comments discuss discussed think thought speak spoke management company explain explained any anything " +
    "is are was were the a an of on in for to and or how why when where which who will would could should can there this " +
    "that these those it its with from by as at be been being has have had me us our we you your i please give").split(" "),
);

/** The question's content words, filler removed: what the passages have to be about. */
export function contentWords(q: string): string[] {
  return q
    .replace(/(\d),(?=\d)/g, "$1")      // "20,000" is one number, not "20" and "000"
    .toLowerCase()
    .replace(/[^a-z0-9&%.\- ]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((w, i, all) => w.length > 1 && !FILLER.has(w) && all.indexOf(w) === i);   // each word once: a repeated word isn't more of the question
}

/** The parts of a question that carry a number (a period such as FY30, a year, an amount) decide what is being
 *  asked: a passage about FY27 margins does not answer a question about FY30 margins (full review F02). These
 *  must appear in a passage, in any of their usual spellings, before it can count as matching the question. */
export function required(words: string[]): string[] {
  return words.filter((w) => /\d/.test(w));
}

function spellings(tok: string): RegExp[] {
  const t = tok.toLowerCase();
  const b = (x: string) => new RegExp(`(^|[^a-z0-9])${x}($|[^a-z0-9])`);
  let m = t.match(/^fy'?(\d{2}|\d{4})$/);
  if (m) {
    const yy = m[1].slice(-2), y4 = Number(`20${yy}`);
    return [b(`fy\\s?'?${yy}`), b(`fy\\s?${y4}`), b(`${y4 - 1}\\s?[-–]\\s?(${yy}|${y4})`)];
  }
  m = t.match(/^(20\d{2})$/);
  if (m) return [b(m[1]), b(`fy\\s?'?${m[1].slice(-2)}`)];
  m = t.match(/^([qh][1-4])\s?(fy'?\d{2,4})?$/);
  if (m) return [b(m[1] + (m[2] ? `\\s?${m[2]}` : ""))];
  const lit = t.replace(/,/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // a plain number may sit against a currency word ("INR20,000"): bound it by other digits only
  if (/^[\d.]+%?$/.test(t)) return [new RegExp(`(^|[^0-9.])${lit}($|[^0-9])`)];
  return [b(lit)];
}

/** Whether a passage carries every required part of the question. */
export function carries(body: string, req: string[]): boolean {
  const text = body.toLowerCase().replace(/(\d),(\d)/g, "$1$2").replace(/\s+/g, " ");
  return req.every((tok) => spellings(tok).some((re) => re.test(text)));
}

/** How much of the question a passage has to cover to count as an answer: every word of a one- or two-word
 *  question, three of four, and so on (60%, rounded up). Below that the app says the documents don't say. */
export function enough(matched: number, terms: number): boolean {
  return terms > 0 && matched >= Math.ceil(terms * 0.6) && matched >= Math.min(terms, 2);
}

const ok = (sym: string) => /^[A-Z0-9&-]{1,20}$/.test(sym);

export async function ask(symbol: string, question: string): Promise<AskResult> {
  const sym = symbol.toUpperCase();
  const words = contentWords(question).slice(0, 12);
  if (!ok(sym)) return { status: "unavailable" };
  return supabaseEnabled ? askSupabase(sym, words) : askLocal(sym, words);
}

// ---- production: Postgres full-text search (migration 005, ask_passages) ----

const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

type Row = { i: number; s: number; page: number; who: string | null; role: AskHit["role"]; body: string; snippet: string; matched: string[]; terms: number };

async function askSupabase(sym: string, words: string[]): Promise<AskResult> {
  // not cached: the source list must be the same version as the passages it numbers (full review F13)
  const src = await fetch(`${SUPABASE_URL}/rest/v1/passage_sources?symbol=eq.${encodeURIComponent(sym)}&select=i,label,url,n&order=i`, {
    headers: H,
    cache: "no-store",
  });
  if (!src.ok) return { status: "unavailable" };      // the table doesn't exist until migration 005 is applied
  const sources = ((await src.json()) as (AskSource & { i: number })[]).map(({ label, url, n }) => ({ label, url, n }));
  if (!sources.length) return { status: "empty", sources };
  if (!words.length) return { status: "none", terms: [], hits: [], sources };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ask_passages`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ sym, q: words.join(" "), k: 8 }),
    cache: "no-store",
  });
  if (!r.ok) return { status: "unavailable" };
  const rows = (await r.json()) as Row[];
  const terms = rows[0]?.terms ?? words.length;
  const hits = rows.map((x) => toHit(x, sources));
  const top = hits[0];
  if (top && (top.role === "a" || top.role === "")) {
    // an analyst asked it: the company's reply is the next turn by someone else, if it's management
    const n = await fetch(
      `${SUPABASE_URL}/rest/v1/passages?symbol=eq.${encodeURIComponent(sym)}&i=gt.${top.i}&i=lte.${top.i + 4}&s=eq.${top.s}&select=who,role,page,body&order=i`,
      { headers: H, cache: "no-store" },
    );
    const after = n.ok ? ((await n.json()) as { who: string | null; role: string; page: number; body: string }[]) : [];
    const next = after.find((x) => x.who !== top.who);
    if (next?.role === "m") top.reply = { who: next.who, page: next.page, snippet: clip(next.body, 420) };
  }
  return verdict(hits, terms, sources, words);
}

function toHit(x: Row, sources: AskSource[]): AskHit {
  return { i: x.i, s: x.s, source: sources[x.s] ?? { label: "Document", url: "", n: 0 }, page: x.page, who: x.who, role: x.role, snippet: x.snippet, matched: x.matched, body: x.body };
}

function verdict(hits: AskHit[], terms: number, sources: AskSource[], words: string[]): AskResult {
  const req = required(words);
  // the period, year or amount in the question must be in the passage: words alone are not a match (full review F02)
  const ok = (h: AskHit) => !req.length || carries(h.body ?? h.snippet, req);
  // the full text stays on the server
  const strip = (hs: AskHit[]) => hs.map((h) => Object.fromEntries(Object.entries(h).filter(([k]) => k !== "body")) as AskHit);
  const good = hits.filter((h) => enough(h.matched.length, terms) && ok(h));
  if (good.length) return { status: "answer", terms: words, hits: strip(dedupe(good).slice(0, 3)), sources };
  const missing = req.filter((tok) => !hits.some((h) => carries(h.body ?? h.snippet, [tok])));
  // nothing covers the question: at most two nearest mentions, labelled as such, and only if they carry at
  // least half the question ("world" alone is not a near answer to "cricket world cup sponsorship")
  const near = hits.filter((h) => h.matched.length * 2 >= terms);
  return { status: near.length ? "partial" : "none", terms: words, hits: strip(dedupe(near).slice(0, 2)), sources, missing };
}

/** Two passages from the same speaker on the same page say the same thing twice: keep the first. */
function dedupe(hits: AskHit[]): AskHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.source.label}|${h.page}|${h.who}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function clip(t: string, n: number): string {
  if (t.length <= n) return t;
  const cut = t.lastIndexOf(". ", n);
  return (cut > n * 0.5 ? t.slice(0, cut + 1) : t.slice(0, n).replace(/\s+\S*$/, "") + " …");
}

// ---- local development: the same rules over data/passages/{SYM}.json ----

const DATA_DIR = process.env.FINN_DATA_DIR ?? path.join(process.cwd(), "..", "data");

/** A light English stemmer, enough to match "margins" with "margin" and "prices" with "price". */
function stem(w: string): string {
  return w
    .toLowerCase()
    .replace(/ies$/, "y")
    .replace(/(ss|us|is)$|(?:(?<=[sxz]|ch|sh)es|ing|ed|s)$/, (m, keep) => (keep ? m : ""))
    .replace(/(.{3,})e$/, "$1");
}

type LocalFile = { sources: AskSource[]; passages: { s: number; p: number; who: string | null; r: AskHit["role"]; t: string }[] };

async function askLocal(sym: string, words: string[]): Promise<AskResult> {
  let d: LocalFile;
  try {
    d = JSON.parse(await readFile(path.join(DATA_DIR, "passages", `${sym}.json`), "utf8")) as LocalFile;
  } catch {
    return { status: "empty", sources: [] };
  }
  const sources = d.sources.map((s) => ({ ...s, n: s.n ?? 0 }));
  if (!words.length) return { status: "none", terms: [], hits: [], sources };
  const terms = [...new Set(words.map(stem))];
  const boost = { m: 1.3, r: 1.1, a: 0.6, "": 1 } as const;
  const scored = d.passages
    .map((p, i) => {
      const toks = p.t.toLowerCase().split(/[^a-z0-9&%]+/).map(stem);
      const matched = terms.filter((t) => toks.includes(t));
      const freq = toks.filter((t) => terms.includes(t)).length;
      return { p, i, matched, score: (freq / Math.sqrt(toks.length + 20)) * boost[p.r] };
    })
    .filter((x) => x.matched.length)
    .sort((a, b) => b.matched.length - a.matched.length || b.score - a.score)
    .slice(0, 8);
  // a window around the first matched word, like the database's headline
  const around = (t: string) => {
    const at = t.toLowerCase().split(/(?=[^a-z0-9&%])/).findIndex((w) => terms.includes(stem(w.replace(/[^a-z0-9&%]/g, ""))));
    const pos = at < 0 ? 0 : t.toLowerCase().split(/(?=[^a-z0-9&%])/).slice(0, at).join("").length;
    const from = Math.max(0, t.lastIndexOf(". ", Math.max(0, pos - 120)) + 1);
    return (from > 0 ? "… " : "") + clip(t.slice(from).trim(), 360);
  };
  const mark = (t: string) =>
    around(t).replace(/[A-Za-z0-9&%]+/g, (w) => (terms.includes(stem(w)) ? `<<${w}>>` : w));
  const hits: AskHit[] = scored.map(({ p, i, matched }) => ({
    i,
    source: sources[p.s] ?? { label: "Document", url: "", n: 0 },
    page: p.p,
    who: p.who,
    role: p.r,
    snippet: mark(p.t),
    matched,
    body: p.t,
    s: p.s,
  }));
  const top = hits[0];
  // the reply must come from the same document (full review F02): a passage four rows on can be another call
  const next = top ? d.passages.slice(top.i + 1, top.i + 5).find((x) => x.who !== top.who && x.s === d.passages[top.i].s) : undefined;
  if (top && (top.role === "a" || top.role === "") && next?.r === "m") top.reply = { who: next.who, page: next.p, snippet: clip(next.t, 420) };
  return verdict(hits, terms.length, sources, words);
}
