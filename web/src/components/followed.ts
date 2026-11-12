// Questions the investor follows, kept in this browser only (creative review §5; visual review §10).
// Honest scope: FINN checks them when a page opens; there is no background job or notification.

export type Revisit = "results" | "call" | "filing" | "date";
export type Mark = "supports" | "challenges" | "unclear";

export type Followed = {
  id: string;
  symbol: string;
  company: string;
  title: string;          // the event or promise it started from
  question: string;       // the investor's wording, kept as edited
  revisit: Revisit;
  date?: string;          // YYYY-MM-DD, for revisit "date"
  href: string;           // the investigation to reopen
  savedAt: string;        // ISO, when it was first saved
  resolve?: string;       // "What evidence would resolve this?" (the investor's own test)
  marks?: Record<string, Mark>;   // the investor's reading of each later document, by card id
  status?: "open" | "answered";
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

/** False when the browser refused to store it (private mode, storage full): the caller says so. */
function write(list: Followed[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
    const ok = localStorage.getItem(KEY) !== null;
    window.dispatchEvent(new Event(CHANGED));
    return ok;
  } catch {
    return false;
  }
}

export function findByHref(href: string): Followed | undefined {
  return readQuestions().find((q) => q.href === href);
}

/** One saved question per investigation: saving again updates it (wording, revisit, test), never duplicates. */
export function saveQuestion(q: Omit<Followed, "id" | "savedAt">): boolean {
  const list = readQuestions();
  const prev = list.find((x) => x.href === q.href || (x.symbol === q.symbol && x.question === q.question));
  const rest = list.filter((x) => x !== prev);
  const item: Followed = { ...prev, ...q, id: prev?.id ?? `${q.symbol}-${Date.now().toString(36)}`, savedAt: prev?.savedAt ?? new Date().toISOString() };
  return write([item, ...rest]);
}

export function updateQuestion(id: string, patch: Partial<Followed>): boolean {
  return write(readQuestions().map((x) => (x.id === id ? { ...x, ...patch } : x)));
}

export function dropQuestion(id: string): boolean {
  return write(readQuestions().filter((x) => x.id !== id));
}
