import { getView } from "@/lib/data";
import type { Contact } from "@/lib/types";

/**
 * Ask your own network directly (the brief: "can also be queried directly"): a person's name, a theme
 * ("specialty chemicals", "rural lending"), a company or ticker someone worked at, or a school.
 * Deterministic matching over the visitor's own contacts (row-level security; nothing goes to a model).
 */
export async function GET(request: Request) {
  // "who knows TCS" / "anyone at Bosch" -> the name; the supported phrasings are deliberately few
  const raw = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  const asked = raw.match(/^(?:who|anyone|someone|people|experts?)\b.*?\b(?:knows?|at|in|on|from|about|worked at|works at|studied at)\s+(.+?)\??$/i);
  const q = (asked ? asked[1] : raw).trim().toLowerCase().slice(0, 60);
  if (q.length < 2) return Response.json([]);
  const view = await getView();
  const out = view.contacts
    .map((c) => match(c, q))
    .filter((m): m is Hit => m !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ id, name, why, match }) => ({ id, name, why, match }));
  return Response.json(out);
}

type Hit = { id: string; name: string; why: string; score: number; match: "name" | "theme" | "employer" | "school" | "near" };

function span(start?: string | null, end?: string | null) {
  const y = (s?: string | null) => (s ? s.slice(0, 4) : "");
  return end ? `${y(start)}–${y(end).slice(2)}` : `${y(start)}–now`;
}

function match(c: Contact, q: string): Hit | null {
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  // a word must start the way the query does: "chem" finds "chemicals", not "schemes"
  const starts = (s: string, w: string) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(s);
  const has = (s: string | null | undefined) => !!s && (starts(s, q) || words.every((w) => starts(s, w)));
  if (c.name.toLowerCase().split(/\s+/).some((t) => t.startsWith(q)) || c.name.toLowerCase().startsWith(q))
    return { id: c.id, name: c.name, score: 100, match: "name", why: `${c.current?.role ?? ""}, ${c.current?.org ?? ""}`.replace(/^, |, $/g, "") };
  const dom = (c.domains ?? []).find((d) => has(d) || (q.length >= 4 && starts(q, d.toLowerCase())));
  if (dom) return { id: c.id, name: c.name, score: 85, match: "theme", why: `knows ${dom} (${c.current?.role ?? ""}, ${c.current?.org ?? ""})` };
  const job = (c.history ?? []).find((h) => has(h.org) || (h.symbol && h.symbol.toLowerCase() === q));
  if (job)
    return {
      id: c.id,
      name: c.name,
      score: job.end ? 80 : 75,
      match: "employer",
      why: job.end ? `was ${job.role} at ${job.org}, ${span(job.start, job.end)}` : `works at ${job.org} now (${job.role}); insider`,
    };
  if (has(c.current?.org)) return { id: c.id, name: c.name, score: 75, match: "employer", why: `works at ${c.current.org} now (${c.current.role}); insider` };
  const school = (c.education ?? []).find((e) => has(e.school));
  if (school) return { id: c.id, name: c.name, score: 60, match: "school", why: `studied at ${school.school} (${school.year})` };
  // nearest theme: a distinctive word in common ("rural lending" -> "consumer lending"), said as such
  const near = (c.domains ?? []).find((d) => words.some((w) => w.length >= 5 && starts(d, w)));
  if (near) return { id: c.id, name: c.name, score: 40, match: "near", why: `closest match: knows ${near} (${c.current?.role ?? ""})` };
  return null;
}
