import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type { Ledger, Snapshot } from "./types";

// Development reads the worker's local export. Production reads Supabase
// (see lib/supabase.ts); both return the same Snapshot shape. The worker
// refreshes data every ~15 minutes, so a minutes-scale cache is honest.
const DATA_DIR = process.env.FINN_DATA_DIR ?? path.join(process.cwd(), "..", "data");

export async function getSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheLife("minutes");
  const raw = await readFile(path.join(DATA_DIR, "snapshot.json"), "utf8");
  return JSON.parse(raw) as Snapshot;
}

export async function getLedger(symbol: string): Promise<Ledger | null> {
  "use cache";
  cacheLife("hours");
  try {
    const raw = await readFile(path.join(DATA_DIR, "ledgers", `${symbol.toUpperCase()}.json`), "utf8");
    return JSON.parse(raw) as Ledger;
  } catch {
    return null;
  }
}
