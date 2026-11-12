import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { Dock } from "@/components/Dock";
import { Suspense } from "react";
import { getLedger, getRequest, getUniverse, getView } from "@/lib/data";
import { RequestButton } from "./RequestButton";
import { day, dirClass, pct, price as fmtPrice, when } from "@/lib/format";
import { SectionNav } from "@/components/SectionNav";
import { EditionCard } from "@/components/EditionCard";
import { PromisesLedger } from "@/components/PromisesLedger";
import { ResultsTable } from "@/components/ResultsTable";
import { ResultsVisual } from "@/components/ResultsVisual";
import { MoveSpark } from "@/components/MoveSpark";
import { NetworkLine } from "@/components/NetworkLine";
import { FollowedQuestions } from "@/components/FollowedQuestions";
import { fromPromise, promiseHref, resultsQuestion } from "@/lib/investigate";
import type { Ledger, Snapshot } from "@/lib/types";

export default function CompanyPage({ params }: PageProps<"/c/[symbol]">) {
  return (
    <Suspense
      fallback={
        <main aria-busy="true">
          <p className="min-h-[44px] content-center text-small text-ink-3">‹ Edition</p>
          <p className="mt-1 text-small text-ink-3">Opening dossier…</p>
        </main>
      }
    >
      <Company params={params} />
    </Suspense>
  );
}

async function Company({ params }: { params: PageProps<"/c/[symbol]">["params"] }) {
  const { symbol: raw } = await params;
  let symbol: string;
  try {
    symbol = decodeURIComponent(raw).toUpperCase();
  } catch {
    notFound();                                   // a malformed address (e.g. /c/%E0%A4) is not a company
  }
  const [snap, ledger, uni, req] = await Promise.all([getView(), getLedger(symbol), getUniverse(), getRequest(symbol)]);
  const listed = uni.find(([s]) => s === symbol);
  if (!listed) {
    const close = uni.filter(([s, n]) => s.startsWith(symbol.slice(0, 3)) || n.toUpperCase().includes(symbol)).slice(0, 5);
    return (
      <main>
        <BackLink fallback="/" />
        <h1 className="font-serif text-title">No NSE equity called {symbol}</h1>
        {close.length > 0 && <p className="mt-2 text-small text-ink-3">Did you mean</p>}
        {close.length > 0 && (
          <ul className="hair mt-3 text-body">
            {close.map(([s, n]) => (
              <li key={s}>
                <Link href={`/c/${s}`} className="flex min-h-[48px] items-center gap-3">
                  <span className="font-medium text-accent">{s}</span> <span className="truncate text-small text-ink-2">{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }
  const holding = snap.portfolio.find((h) => h.symbol === symbol);
  const name = snap.names[symbol] ?? listed[1];
  const price = snap.prices[symbol];
  const results = snap.results[symbol];
  // filings plus the sessions that moved at least 2% or 1.5x volume (the full list sits in the move registry)
  const moves = (snap.move_cards ?? []).filter((c) => {
    const f = c.facts as { change_pct?: number; volume_multiple?: number };
    return c.symbol === symbol && (Math.abs(f.change_pct ?? 0) >= 2 || (f.volume_multiple ?? 0) >= 1.5);
  });
  const all = [...snap.editions["30d"].leads, ...snap.editions["30d"].more, ...moves].filter((c) => c.symbol === symbol);
  const filings = all.sort((a, b) => b.at.localeCompare(a.at));

  const people = snap.people[symbol] ?? [];
  const sections = [
    results && ["results", "Results"],
    ["promises", "Promises"],
    people.length > 0 && ["people", "People"],
    filings.length > 0 && ["filings", "Filings"],
  ].filter(Boolean) as [string, string][];

  return (
    <main>
      <BackLink fallback="/" />

      <header>
        {/* the ticker, then the facts about it as tags: no dot-separated run-on */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="kicker text-ink-3">{symbol}</span>
          {holding && <span className="tag">{holding.sector}</span>}
          {holding && <span className="tag num">{holding.weight}% of portfolio</span>}
          {!holding && snap.research_set.includes(symbol) && <span className="tag">Research list</span>}
        </div>
        <h1 className="mt-1 font-serif text-display">{name.replace(/ Limited$/, "")}</h1>
        {price && (
          <div className="mt-2">
            <p className="flex items-baseline gap-2.5 text-body">
              <span className="num font-medium">{fmtPrice(price.close)}</span>
              <span className={`num font-medium ${dirClass(price.change_pct)}`}>{pct(price.change_pct)}</span>
            </p>
            <p className="text-caption text-ink-3">
              Close on <span className="num">{day(price.day + "T15:30:00", snap.data_until)}</span>
            </p>
            {/* how it has traded lately: the same word-sized chart as the alerts, to the latest session */}
            {snap.price_history?.[symbol] && (
              <div className="mt-2 flex items-end gap-3">
                <MoveSpark rows={snap.price_history[symbol]} day={price.day} width={150} height={40} label={`${symbol}: price over the last 20 sessions and each day's volume`} />
                <span className="pb-0.5 text-caption text-ink-3">Last 20 sessions; bars are volume</span>
              </div>
            )}
          </div>
        )}
      </header>

      {sections.length > 2 && <SectionNav sections={sections} />}

      {ledger?.snapshot && ledger.snapshot.what_they_do.length > 0 && (
        <section className="mt-8">
          <h2 className="section-h">
            <span>What they do</span>
            <span className="text-caption font-normal normal-case tracking-normal text-ink-3">FY{String(ledger.snapshot.year).slice(2)} annual report</span>
          </h2>
          <ul className="mt-2.5 space-y-2 text-body">
            {ledger.snapshot.what_they_do.slice(0, 2).map((x, i) => (
              <li key={i}>
                {x.text}{" "}
                <a href={`${ledger.snapshot!.url}#page=${x.page}`} target="_blank" rel="noopener noreferrer" className="tap num text-caption text-accent">
                  AR p.{x.page}
                </a>
              </li>
            ))}
          </ul>
          {(ledger.snapshot.what_they_do.length > 2 || ledger.snapshot.segments.length > 0) && (
            <details className="group mt-1">
              <summary className="inline-flex min-h-[44px] items-center gap-1 text-small text-accent">
                More, with segments <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>
              </summary>
              <ul className="space-y-2 text-body">
                {ledger.snapshot.what_they_do.slice(2).map((x, i) => (
                  <li key={i}>
                    {x.text}{" "}
                    <a href={`${ledger.snapshot!.url}#page=${x.page}`} target="_blank" rel="noopener noreferrer" className="tap num text-caption text-accent">
                      AR p.{x.page}
                    </a>
                  </li>
                ))}
              </ul>
              {ledger.snapshot.segments.filter((g) => g.share_of_revenue_pct != null).length >= 2 ? (
                <SegmentBars segments={ledger.snapshot.segments} url={ledger.snapshot.url} year={ledger.snapshot.year} />
              ) : ledger.snapshot.segments.length > 0 && (
                <p className="mt-2 text-small text-ink-2">
                  Segments:{" "}
                  {ledger.snapshot.segments
                    .map((g) => `${g.name}${g.share_of_revenue_pct != null ? ` (${g.share_of_revenue_pct}% of revenue)` : ""}`)
                    .join(", ")}
                </p>
              )}
            </details>
          )}
        </section>
      )}

      <FollowedQuestions symbol={symbol} />
      <Questions symbol={symbol} snap={snap} ledger={ledger} />

      {results && (
        <section id="results" className="mt-10 scroll-mt-4">
          <h2 className="section-h">Latest results</h2>
          {/* the picture first, the exact table under it (visual review §8) */}
          <ResultsVisual r={results} question={resultsLink(symbol, snap)} />
          <ResultsTable r={results} />
        </section>
      )}

      <div id="promises" className="mt-10 scroll-mt-4">
        {ledger ? (
          <PromisesLedger ledger={ledger} verifiers={snap.verifiers} />
        ) : (
          <section>
            <h2 className="section-h">Promised vs delivered</h2>
            <div className="mt-4 rounded-lg bg-tint px-4 py-4">
              <p className="font-serif text-subhead">Not covered yet</p>
              <p className="mt-1 text-small text-ink-2">
                FINN builds this from the last four earnings-call transcripts and the annual report, nothing else. Every promise
                is quoted with its page, and each status follows fixed rules, not a model&apos;s judgement.
              </p>
              <Coverage symbol={symbol} req={req} dataUntil={snap.data_until} />
            </div>
          </section>
        )}
      </div>

      {people.length > 0 && (
        <section id="people" className="mt-10 scroll-mt-4">
          <h2 className="section-h">People who&apos;d know</h2>
          {people.map((l, i) => (
            <NetworkLine key={l.contact_id} line={l} asOf={snap.data_until} reason={i === 0 && l.best_reason && l.best_reason !== l.relation ? l.best_reason : undefined} />
          ))}
        </section>
      )}

      {filings.length > 0 && (
        <section id="filings" className="mt-10 scroll-mt-4">
          <h2 className="section-h">
            <span>Filings and moves</span>
            <span className="text-caption font-normal normal-case tracking-normal text-ink-3">last 30 days</span>
          </h2>
          <div className="hair">
            {/* the people above already cover this company: no repeated line under every filing */}
            {filings.map((c) => (
              <EditionCard key={c.id} card={c} refTime={snap.data_until} compact showNetwork={false} />
            ))}
          </div>
        </section>
      )}
      <Dock />
    </main>
  );
}

function Coverage({ symbol, req, dataUntil }: { symbol: string; req: Awaited<ReturnType<typeof getRequest>>; dataUntil: string }) {
  if (req?.status === "unavailable") {
    return <p className="mt-3 text-small text-ink">{req.detail ?? "Not enough primary material to build a ledger."}</p>;
  }
  if (req?.status === "ready") {
    return <p className="mt-3 text-small text-ink">Built. The ledger appears here within a few minutes as the cache refreshes.</p>;
  }
  if (req) {
    return (
      <p className="mt-3 text-small text-ink">
        {req.status === "building" ? "Building now" : "Queued"} since <span className="num">{when(req.requested_at)}</span> IST. FINN is reading
        the last four earnings-call transcripts and checking every quote against its page; this usually takes a few minutes once
        picked up. FINN last updated at <span className="num">{when(dataUntil)}</span> IST.
        {req.detail ? <span className="mt-1 block text-caption italic text-ink-3">{req.detail}</span> : null}
      </p>
    );
  }
  return <RequestButton symbol={symbol} />;
}

/** Three questions worth the investor's attention, from the latest results and the promises that changed
 *  (creative review, company hierarchy step 3). Each opens its investigation. None when nothing supports one. */
function Questions({ symbol, snap, ledger }: { symbol: string; snap: Snapshot; ledger: Ledger | null }) {
  const out: { tag: string; q: string; href: string }[] = [];
  // the results question sits under the results chart, beside its evidence; these are the promise questions
  if (ledger) {
    const pick = (st: string[]) =>
      ledger.rows
        .filter((r) => st.includes(r.latest) && !/: (no figure|direction only)$/.test(r.title))
        .sort((a, b) => (b.mentions ?? 1) - (a.mentions ?? 1))[0];
    for (const [r, tag] of [[pick(["revised"]), "Promise revised"], [pick(["silent", "missed", "partly"]), "Promise went quiet"]] as const) {
      if (r && out.length < 3) out.push({ tag: r.latest === "silent" ? "Promise went quiet" : r.latest === "revised" ? tag : "Promise settled", q: fromPromise(r, ledger, snap).question, href: promiseHref(symbol, r) });
    }
    const tracked = ledger.rows.find((r) => r.tracking);
    if (tracked && out.length < 3) out.push({ tag: "Promise on course?", q: fromPromise(tracked, ledger, snap).question, href: promiseHref(symbol, tracked) });
  }
  if (!out.length) return null;
  return (
    <section className="mt-10" aria-labelledby="questions-h">
      <h2 id="questions-h" className="section-h">
        <span>Questions worth your attention</span>
      </h2>
      <ul className="hair mt-1">
        {out.map((x) => (
          <li key={x.href}>
            <Link href={x.href} className="group block py-3">
              <span className="tag">{x.tag}</span>
              <span className="mt-1.5 block font-serif text-subhead text-ink group-hover:underline">{x.q}</span>
              <span className="mt-1 inline-flex text-small font-medium text-accent">Investigate ›</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-caption text-ink-3">Written from the filed figures and the call-by-call record, by fixed rules.</p>
    </section>
  );
}

/** The one question the results raise, and where to investigate it (the edition card if there is one). */
function resultsLink(symbol: string, snap: Snapshot): { text: string; href: string } | undefined {
  const r = snap.results[symbol];
  const q = r && resultsQuestion(r);
  if (!q) return undefined;
  const card = [...snap.editions["30d"].leads, ...snap.editions["30d"].more]
    .filter((c) => c.symbol === symbol && c.kind === "results" && c.facts.results?.period_end === r.period_end)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return { text: q.q, href: card ? `/investigate?card=${card.id}` : `/investigate?c=${encodeURIComponent(symbol)}&r=1` };
}

/** Business mix, ranked, from the shares the annual report itself states (visual review §9). Drawn only
 *  when at least two segments carry a disclosed share; nothing is split evenly or estimated. */
function SegmentBars({ segments, url, year }: { segments: { name: string; share_of_revenue_pct?: number | null; page: number }[]; url: string; year: number }) {
  const rows = segments.filter((g) => g.share_of_revenue_pct != null).sort((a, b) => b.share_of_revenue_pct! - a.share_of_revenue_pct!);
  const sum = rows.reduce((a, g) => a + g.share_of_revenue_pct!, 0);
  const undisclosed = segments.filter((g) => g.share_of_revenue_pct == null).map((g) => g.name);
  return (
    <figure className="mt-3">
      <figcaption className="text-caption text-ink-3">Share of revenue by segment, FY{String(year).slice(2)}, as the annual report states it</figcaption>
      <ul className="mt-2 space-y-1.5">
        {rows.map((g) => (
          <li key={g.name} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-caption">
            <span className="truncate text-ink-2" title={g.name}>{g.name}</span>
            <span className="h-2.5 rounded-sm bg-tint" aria-hidden>
              <span className="block h-full rounded-sm bg-ink-3" style={{ width: `${Math.min(100, g.share_of_revenue_pct!)}%` }} />
            </span>
            <a href={`${url}#page=${g.page}`} target="_blank" rel="noopener noreferrer" className="num text-right text-ink hover:text-accent">
              {g.share_of_revenue_pct}%
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-caption text-ink-3">
        {Math.abs(sum - 100) > 1.5 ? `The stated shares add up to ${Math.round(sum)}%, not 100%; FINN doesn't fill the gap. ` : ""}
        {undisclosed.length ? `No share stated for ${undisclosed.join(", ")}. ` : ""}Tap a figure for its page.
      </p>
    </figure>
  );
}
