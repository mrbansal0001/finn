// Questions the investor follows, kept in this browser only (creative review §5, "keep following").
// Honest scope: FINN checks them when the edition is opened; there is no background job or notification.

export type Revisit = "results" | "call" | "filing" | "date";

export type Followed = {
  id: string;
  symbol: string;
  company: string;
  title: string;          // the event or promise it started from
  question: string;
  revisit: Revisit;
  date?: string;          // YYYY-MM-DD, for revisit "date"
  href: string;           // the investigation to reopen
  savedAt: string;        // ISO, when it was saved
};

const KEY = "finn_questions";
export const CHANGED = "finn:questions";

export function readQuestions(): Followed[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.question === "string" && typeof x.symbol === "string") : [];
  } catch {
    return [];
  }
}

function write(list: Followed[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

export function saveQuestion(q: Omit<Followed, "id" | "savedAt">): void {
  const list = readQuestions().filter((x) => !(x.symbol === q.symbol && x.question === q.question));
  write([{ ...q, id: `${q.symbol}-${Date.now().toString(36)}`, savedAt: new Date().toISOString() }, ...list]);
}

export function dropQuestion(id: string): void {
  write(readQuestions().filter((x) => x.id !== id));
}
