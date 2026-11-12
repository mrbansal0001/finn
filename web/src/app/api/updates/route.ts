import { getSnapshot } from "@/lib/data";

/**
 * The filings for the companies a visitor follows questions on (public data only: the questions themselves
 * stay in the visitor's browser and are never sent; only tickers are).
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("s") ?? "";
  const wanted = new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z0-9&-]{1,20}$/.test(s)).slice(0, 30));
  if (!wanted.size) return Response.json({ until: null, items: [] });
  const snap = await getSnapshot();
  const ed = snap.editions["30d"];
  const items = [...ed.leads, ...ed.more]
    .filter((c) => wanted.has(c.symbol) && c.kind !== "move")
    .map((c) => ({ id: c.id, symbol: c.symbol, kind: c.kind, at: c.at, headline: c.headline ?? c.nse_subject }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return Response.json({ until: snap.data_until, items });
}
