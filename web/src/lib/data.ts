import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type { Contact, Ledger, NetworkLine, Snapshot } from "./types";
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
    const rows = (await r.json()) as { payload: Omit<Snapshot, "people" | "verifiers" | "contacts"> }[];
    // the public payload carries no network data by construction (worker sync.split)
    return { ...rows[0].payload, people: {}, verifiers: {}, contacts: [] };
  }
  return JSON.parse(await readFile(path.join(DATA_DIR, "snapshot.json"), "utf8")) as Snapshot;
}

export async function getLedger(symbol: string): Promise<Ledger | null> {
  "use cache";
  cacheLife("hours");
  const sym = symbol.toUpperCase();
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

type PrivateNetwork = { lines: Record<string, NetworkLine[]>; contacts: Contact[] };

/** The visitor's own network (never cached across users). Null in local mode. */
export async function getNetwork(): Promise<PrivateNetwork | null> {
  if (!supabaseEnabled) return null;
  const sb = await supabaseForRequest();
  const [lines, contacts] = await Promise.all([
    sb.from("network_lines").select("card_id, lines"),
    sb.from("contacts").select("id, name, profile, interactions_12m, last_contact, reciprocity, rating"),
  ]);
  return {
    lines: Object.fromEntries((lines.data ?? []).map((r) => [r.card_id as string, r.lines as NetworkLine[]])),
    contacts: (contacts.data ?? []).map((c) => ({
      id: c.id, name: c.name, ...(c.profile as object), interactions_12m: c.interactions_12m,
      last_contact: c.last_contact, reciprocity: c.reciprocity, rating: c.rating,
    })) as Contact[],
  };
}

/** Merge the visitor's network into the public snapshot. Local mode: already merged. */
export function withNetwork(snap: Snapshot, net: PrivateNetwork | null): Snapshot {
  if (!net) return snap;
  const s = structuredClone(snap);
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
  return s;
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
  if (supabaseEnabled) {
    const sb = await supabaseForRequest();
    const { data } = await sb.from("coverage_requests").select("*").eq("symbol", symbol).maybeSingle();
    return (data as CoverageRequest) ?? null;
  }
  try {
    const q = JSON.parse(await readFile(path.join(DATA_DIR, "requests.json"), "utf8")) as CoverageRequest[];
    return q.find((r) => r.symbol === symbol) ?? null;
  } catch {
    return null;
  }
}
