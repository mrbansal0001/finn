"use server";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { supabaseEnabled } from "@/lib/supabase/config";
import { supabaseForRequest } from "@/lib/supabase/server";
import { getUniverse } from "@/lib/data";

const DATA_DIR = process.env.FINN_DATA_DIR ?? path.join(process.cwd(), "..", "data");

export type RequestState = { ok: boolean; message: string } | null;

/** Queue a Promises-ledger build for a ticker we don't cover yet. The residential worker drains the queue.
 *  Returns what happened, so a refused or failed request is never silent. */
export async function requestCoverage(_prev: RequestState, form: FormData): Promise<RequestState> {
  const symbol = String(form.get("symbol") ?? "").toUpperCase();
  const uni = await getUniverse();
  if (!uni.some(([s]) => s === symbol)) return { ok: false, message: "Not an NSE equity symbol." };
  if (supabaseEnabled) {
    const sb = await supabaseForRequest();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return { ok: false, message: "Your session didn't start (cookies blocked?). Reload and try again." };
    const { error } = await sb.from("coverage_requests").insert({ symbol, status: "queued" });
    if (error) {
      const dup = error.code === "23505";
      revalidatePath(`/c/${symbol}`);
      return dup ? { ok: true, message: "Already requested; it's in the queue." }
                 : { ok: false, message: "Request limit reached for now (5 per visitor, 50 a day overall). Try another time." };
    }
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
  return { ok: true, message: "Queued." };
}
