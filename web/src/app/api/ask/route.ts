import { ask } from "@/lib/ask";

/** GET /api/ask?c=TITAN&q=gold+prices — answered only from the company's own documents (lib/ask.ts). */
export async function GET(request: Request) {
  const u = new URL(request.url).searchParams;
  const c = (u.get("c") ?? "").trim().toUpperCase();
  const q = (u.get("q") ?? "").trim().slice(0, 200);
  if (!c || !q) return Response.json({ status: "none", terms: [], hits: [], sources: [] });
  return Response.json(await ask(c, q), { headers: { "Cache-Control": "public, max-age=300" } });
}
