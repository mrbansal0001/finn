import type { Card, Contact } from "./types";

/**
 * Keeping the network warm (brief, Network: "I haven't spoken to someone in a while, but their former
 * employer just announced results or a deal: a natural reason to reconnect").
 *
 * A contact you haven't spoken to for at least six months, whose current or former company filed something
 * material in the cards given (not a price move): the newest such filing is the reason. Former employees
 * come first; someone who works there now is still listed, as an insider (public information only).
 * Deterministic, over the visitor's own contacts; nothing goes to a model.
 */
export type Reconnect = { contact: Contact; card: Card; months: number; role: string; insider: boolean };

export function reconnects(contacts: Contact[], cards: Card[], until: string, minDays = 180): Reconnect[] {
  const now = new Date(until).getTime();
  const material = cards.filter((c) => c.kind !== "move").sort((a, b) => b.at.localeCompare(a.at));
  const out: Reconnect[] = [];
  for (const c of contacts) {
    const days = c.last_contact ? (now - new Date(c.last_contact).getTime()) / 86_400_000 : Infinity;
    if (days < minDays) continue;
    const jobs = c.history.filter((h) => h.symbol);
    const card = material.find((m) => jobs.some((h) => h.symbol === m.symbol));
    if (!card) continue;
    const job = jobs.find((h) => h.symbol === card.symbol)!;
    out.push({ contact: c, card, months: Number.isFinite(days) ? Math.round(days / 30.4) : 0, role: job.role, insider: job.end === null });
  }
  // former colleagues first (the natural reason), then the newest filing
  return out.sort((a, b) => Number(a.insider) - Number(b.insider) || b.card.at.localeCompare(a.card.at));
}
