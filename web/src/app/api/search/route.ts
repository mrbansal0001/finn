import { getUniverse } from "@/lib/data";

/** Ticker/name search over all NSE equities: symbol prefix first, then name word prefix. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().toUpperCase() ?? "";
  if (q.length < 1) return Response.json([]);
  const uni = await getUniverse();
  const bySymbol = uni.filter(([s]) => s.startsWith(q));
  const byName = uni.filter(([s, n]) => !s.startsWith(q) && n.toUpperCase().split(/[\s&().-]+/).some((w) => w.startsWith(q)));
  return Response.json([...bySymbol, ...byName].slice(0, 8));
}
