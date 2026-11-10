"use server";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { supabaseEnabled } from "@/lib/supabase/config";
import { supabaseForRequest } from "@/lib/supabase/server";
import { getUniverse } from "@/lib/data";

const DATA_DIR = process.env.FINN_DATA_DIR ?? path.join(process.cwd(), "..", "data");

/** Queue a Promises-ledger build for a ticker we don't cover yet. The residential worker drains the queue. */
export async function requestCoverage(form: FormData) {
  const symbol = String(form.get("symbol") ?? "").toUpperCase();
  const uni = await getUniverse();
  if (!uni.some(([s]) => s === symbol)) return;
  if (supabaseEnabled) {
    const sb = await supabaseForRequest();
    await sb.from("coverage_requests").insert({ symbol, status: "queued" });
  } else {
    const file = path.join(DATA_DIR, "requests.json");
    let q: { symbol: string; status: string; requested_at: string }[] = [];
    try {
      q = JSON.parse(await readFile(file, "utf8"));
    } catch {}
    if (!q.some((r) => r.symbol === symbol)) {
      q.push({ symbol, status: "queued", requested_at: new Date().toISOString() });
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(file, JSON.stringify(q, null, 1));
    }
  }
  revalidatePath(`/c/${symbol}`);
}
