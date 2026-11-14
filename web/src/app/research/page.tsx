import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { About } from "@/components/About";
import { PageSkeleton } from "@/components/Skeletons";
import { ResearchList, type ResearchRow } from "@/components/ResearchList";
import { getUniverse, getView } from "@/lib/data";
import { promiseHref, promiseQuestion, promiseTitle } from "@/lib/investigate";

export const metadata = { title: "Research" };

export default function ResearchPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Opening research…" />}>
      <Research />
    </Suspense>
  );
}

/**
 * Pull's home (three-pillars plan §4): every company FINN has read, with what moved in its promises and the
 * one question worth attention. Portfolio companies without a ledger are listed too, with the way to build one.
 */
async function Research() {
  const [snap, uni] = await Promise.all([getView(), getUniverse()]);
  const index = snap.ledger_index ?? {};
  const names = new Map(uni);
  const holding = new Map(snap.portfolio.map((h) => [h.symbol, h]));
  const portfolio = [...snap.portfolio.map((h) => h.symbol), ...snap.research_set];
  const nifty = new Set(snap.nifty50 ?? []);
  const symbols = [...new Set([...portfolio, ...Object.keys(index)])];
  const rows: ResearchRow[] = symbols.map((s) => {
    const e = index[s];
    const h = holding.get(s);
    const top = e?.top ?? null;
    return {
      symbol: s,
      name: (snap.names[s] ?? names.get(s) ?? s).replace(/ Limited$/i, "").replace(/ Ltd\.?$/i, ""),
      sector: h?.sector ?? null,
      weight: h?.weight ?? null,
      research: snap.research_set.includes(s),
      portfolio: portfolio.includes(s),
      nifty: nifty.has(s),
      ledger: !!e,
      lastCall: e?.last_call ?? null,
      newerCall: e?.newer_call ?? null,
      lastKey: callKey(e?.last_call ?? null),
      counts: e?.counts ?? {},
      rows: e?.rows ?? 0,
      question: top ? promiseQuestion(top, e!.calls.map((c) => ({ ...c, url: "" })), promiseTitle(top.title)) : null,
      questionHref: top ? promiseHref(s, top) : null,
    };
  });
  const promises = rows.reduce((a, r) => a + r.rows, 0);
  const read = rows.filter((r) => r.ledger).length;

  return (
    <main>
      <BackLink fallback="/" label="Edition" />
      <p className="kicker text-ink-3">Research</p>
      <h1 className="mt-1 font-serif text-display">What FINN has read</h1>
      <p className="mt-1 text-body text-ink-2">
        <span className="num">{read}</span> companies, <span className="num">{promises.toLocaleString("en-IN")}</span> promises, each quoted with its page. &ldquo;My
        companies&rdquo; are your <span className="num">{snap.portfolio.length}</span> holdings and <span className="num">{snap.research_set.length}</span> research names.
      </p>
      <ResearchList rows={rows} hasNifty={nifty.size > 0} />
      <About label="About this page">
        <p>
          Each ledger is built from the company&apos;s last four earnings-call transcripts and its annual report, nothing else. Every quote is
          checked against its page, and every status follows fixed rules, not a model&apos;s judgement.
        </p>
      </About>
      <Dock />
    </main>
  );
}

/** "Nov 2026" or "Q2FY27" -> a sortable month number, so "newest call" sorts both label styles. */
function callKey(label: string | null): number {
  if (!label) return 0;
  const m = label.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m) return Number(m[2]) * 12 + ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[1].toLowerCase());
  const q = label.match(/^Q([1-4])\s?FY(\d{2})$/i);
  if (q) return (2000 + Number(q[2]) - 1) * 12 + 3 + (Number(q[1]) - 1) * 3 + 4; // discussed a month after the quarter ends
  return 0;
}
