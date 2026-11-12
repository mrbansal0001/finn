import { getUniverse } from "@/lib/data";

/** Ticker/name search over all NSE equities: symbol prefix first, then names whose words start with every
 *  word of the query ("asian paints" finds Asian Paints; it used to need a single word). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().toUpperCase() ?? "";
  if (q.length < 1) return Response.json([]);
  const uni = await getUniverse();
  const words = q.split(/[\s&().-]+/).filter(Boolean);
  const bySymbol = uni.filter(([s]) => s.startsWith(q.replace(/\s+/g, "")));
  const byName = uni
    .filter(([s, n]) => {
      if (bySymbol.some(([x]) => x === s)) return false;
      const nw = n.toUpperCase().split(/[\s&().-]+/);
      return words.every((w) => nw.some((x) => x.startsWith(w)));
    })
    .sort((a, b) => Number(b[1].toUpperCase().startsWith(q)) - Number(a[1].toUpperCase().startsWith(q)));
  return Response.json([...bySymbol, ...byName].slice(0, 8));
}
