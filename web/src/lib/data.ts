import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import type { Card, Contact, Ledger, NetworkLine, Snapshot } from "./types";
import { SUPABASE_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";
import { supabaseForRequest } from "./supabase/server";

// Two sources, one shape:
//   local  : the worker's export in ../data (development; network already merged in)
//   supabase: public market snapshot (cached for everyone) + the visitor's own network
//             (per request, row-level security)
const DATA_DIR = process.env.FINN_DATA_DIR ?? path.join(process.cwd(), "..", "data");

export async function getSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheLife("minutes");
  if (supabaseEnabled) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/snapshot?id=eq.current&select=payload`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) throw new Error(`snapshot unavailable (HTTP ${r.status})`);
    const rows = (await r.json()) as { payload: Omit<Snapshot, "people" | "verifiers" | "contacts"> }[];
    if (!rows[0]) throw new Error("snapshot not published yet");
    // the public payload carries no network data by construction (worker sync.split)
    return { ...rows[0].payload, people: {}, verifiers: {}, contacts: [] };
  }
  return JSON.parse(await readFile(path.join(DATA_DIR, "snapshot.json"), "utf8")) as Snapshot;
}

export async function getLedger(symbol: string): Promise<Ledger | null> {
  "use cache";
  // minutes, not hours: a ledger a visitor asked for must appear soon after the worker builds it
  cacheLife("minutes");
  const sym = symbol.toUpperCase();
  // NSE symbols are A-Z, 0-9, '&' and '-'; anything else (e.g. '../') is rejected before touching disk or the API
  if (!/^[A-Z0-9&-]{1,20}$/.test(sym)) return null;
  if (supabaseEnabled) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ledgers?symbol=eq.${encodeURIComponent(sym)}&select=payload`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    const rows = (await r.json()) as { payload: Ledger }[];
    return rows[0]?.payload ?? null;
  }
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "ledgers", `${sym}.json`), "utf8")) as Ledger;
  } catch {
    return null;
  }
}

type PrivateNetwork = { ok: boolean; lines: Record<string, NetworkLine[]>; contacts: Contact[] };

/** The visitor's own network (never cached across users). Null in local mode. */
export async function getNetwork(): Promise<PrivateNetwork | null> {
  if (!supabaseEnabled) return null;
  await connection(); // per-visitor data: render at request time (the auth client reads the clock)
  const sb = await supabaseForRequest();
  const [lines, contacts] = await Promise.all([
    // migration 004: demo visitors read the shared template through a checked function; fall back to
    // the per-visitor table while the function doesn't exist yet
    sb.rpc("my_network_lines").then((r) => (r.error ? sb.from("network_lines").select("card_id, lines") : r)),
    sb.from("contacts").select("id, name, profile, interactions_12m, last_contact, reciprocity, rating"),
  ]);
  return {
    // a failed read is "unavailable", never "you know nobody" (audit F11)
    ok: !lines.error && !contacts.error,
    lines: Object.fromEntries((lines.data ?? []).map((r) => [r.card_id as string, r.lines as NetworkLine[]])),
    contacts: (contacts.data ?? []).map((c) => ({
      id: c.id, name: c.name, ...(c.profile as object), interactions_12m: c.interactions_12m,
      last_contact: c.last_contact, reciprocity: c.reciprocity, rating: c.rating,
    })) as Contact[],
  };
}

/** Merge the visitor's network into the public snapshot. Local mode: already merged. */
export function withNetwork(snap: Snapshot, net: PrivateNetwork | null): Snapshot {
  if (!net) return withMoveLines({ ...snap, network_status: "local" });
  const s = structuredClone(snap);
  s.network_status = net.ok && net.contacts.length ? "ready" : "unavailable";
  for (const ed of Object.values(s.editions)) {
    for (const c of [...ed.leads, ...ed.more]) c.network = net.lines[c.id] ?? [];
  }
  s.people = {};
  s.verifiers = {};
  for (const [k, v] of Object.entries(net.lines)) {
    if (k.startsWith("company:")) s.people[k.slice(8)] = v;
    else if (k.startsWith("verify:")) s.verifiers[k.slice(7)] = v[0];
  }
  s.contacts = net.contacts;
  return withMoveLines(s);
}

/** Move cards carry the company's own "who knows this company" lines (no per-card private rows). */
function withMoveLines(s: Snapshot): Snapshot {
  const move_cards = (s.move_cards ?? []).map((c) => ({ ...c, network: (s.people[c.symbol] ?? []).slice(0, 3) }));
  return { ...s, move_cards };
}

/** Any card by its id: every window's edition, then the move registry (audit F01: a 24-hour card need
 *  not exist in the 30-day edition). */
export function findCard(s: Snapshot, id: string): Card | undefined {
  for (const w of ["24h", "3d", "7d", "30d"] as const) {
    const ed = s.editions[w];
    const c = [...ed.leads, ...ed.more].find((x) => x.id === id);
    if (c) return c;
  }
  return (s.move_cards ?? []).find((x) => x.id === id);
}

export async function getView(): Promise<Snapshot> {
  const [snap, net] = await Promise.all([getSnapshot(), getNetwork()]);
  return withNetwork(snap, net);
}

/** All NSE equities as [symbol, name]; changes rarely. */
export async function getUniverse(): Promise<[string, string][]> {
  "use cache";
  cacheLife("days");
  if (supabaseEnabled) {
    const out: [string, string][] = [];
    for (let from = 0; ; from += 1000) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/universe?select=symbol,name&order=symbol`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Range: `${from}-${from + 999}` },
      });
      const rows = (await r.json()) as { symbol: string; name: string }[];
      out.push(...rows.map((x) => [x.symbol, x.name] as [string, string]));
      if (rows.length < 1000) break;
    }
    return out;
  }
  return JSON.parse(await readFile(path.join(DATA_DIR, "universe.json"), "utf8")) as [string, string][];
}

export type CoverageRequest = { symbol: string; status: string; requested_at: string; detail?: string | null };

export async function getRequest(symbol: string): Promise<CoverageRequest | null> {
  if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) return null;
  if (supabaseEnabled) {
    await connection();
    const sb = await supabaseForRequest();
    // who asked is not readable (migration 003): select only the public columns
    const { data } = await sb.from("coverage_requests").select("symbol, status, requested_at, detail").eq("symbol", symbol).maybeSingle();
    return (data as CoverageRequest) ?? null;
  }
  try {
    const q = JSON.parse(await readFile(path.join(DATA_DIR, "requests.json"), "utf8")) as CoverageRequest[];
    return q.find((r) => r.symbol === symbol) ?? null;
  } catch {
    return null;
  }
}
