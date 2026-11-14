import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { Dock } from "@/components/Dock";
import { AskBox } from "@/components/AskBox";
import { Trajectory } from "@/components/Trajectory";
import { CompanySkeleton } from "@/components/Skeletons";
import { Suspense } from "react";
import { getLedger, getRequest, getSnapshot, getUniverse, getView } from "@/lib/data";
import { RequestButton } from "./RequestButton";
import { day, dirClass, fyQuarter, KIND_LABEL, pct, price as fmtPrice, when } from "@/lib/format";
import { SectionNav } from "@/components/SectionNav";
import { PromisesLedger } from "@/components/PromisesLedger";
import { ResultsTable } from "@/components/ResultsTable";
import { ResultsVisual } from "@/components/ResultsVisual";
import { QuestionCard, QuestionRow } from "@/components/QuestionCard";
import { About, AboutPart } from "@/components/About";
import { filingMarkers } from "@/lib/markers";
import { lensLabel } from "@/lib/lenses";
import { MoveSpark } from "@/components/MoveSpark";
import { Mark } from "@/components/StatusIcon";
import { NetworkLine } from "@/components/NetworkLine";
import { FollowedQuestions } from "@/components/FollowedQuestions";
import { fromPromise, promiseHref, resultsQuestion } from "@/lib/investigate";
import type { Ledger, Snapshot } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/c/[symbol]">) {
  const { symbol } = await params;
  let sym = symbol;
  try {
    sym = decodeURIComponent(symbol).toUpperCase();
  } catch {}
  const [snap, uni] = await Promise.all([getSnapshot(), getUniverse()]);
  const name = snap.names[sym] ?? uni.find(([s]) => s === sym)?.[1] ?? sym;
  return { title: name.replace(/ Limited$/i, "") };
}

export default function CompanyPage({ params, searchParams }: PageProps<"/c/[symbol]">) {
  return (
    <Suspense fallback={<CompanySkeleton />}>
      <Company params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Company({ params, searchParams }: Pick<PageProps<"/c/[symbol]">, "params" | "searchParams">) {
  const { symbol: raw } = await params;
  const askParam = (await searchParams).ask;
  const asked = typeof askParam === "string" ? askParam.slice(0, 200) : undefined;
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
        {/* not a dead end: the search stays one tap away, with a way to browse what FINN covers (UX review P1-11) */}
        <p className="mt-2 text-small text-ink-2">
          Try the company&apos;s name in the search box below, or{" "}
          <Link href="/research" className="tap text-accent">
            browse the companies FINN covers ›
          </Link>
        </p>
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
        <Dock />
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
  // filings as rows; price moves as one line that opens the newest (its card has the full chart) (layout plan §5)
  // FINN reads the filing feed only for the holdings and the research list: for any other company an empty list
  // means "not loaded", never "no filings" (full review F06)
  const followed = !!holding || snap.research_set.includes(symbol);
  const filings = [...snap.editions["30d"].leads, ...snap.editions["30d"].more]
    .filter((c) => c.symbol === symbol && c.kind !== "move")
    .sort((a, b) => b.at.localeCompare(a.at));
  const bigMoves = moves.filter((c) => Math.abs((c.facts as { change_pct?: number }).change_pct ?? 0) >= 2).sort((a, b) => b.at.localeCompare(a.at));
  const volMoves = moves.filter((c) => !bigMoves.includes(c)).sort((a, b) => b.at.localeCompare(a.at));
  const history = snap.price_history?.[symbol];
  const marks = history ? [...new Set(filingMarkers(snap, symbol, history.map((r) => r.d)).map((m) => m.d))] : [];

  const people = snap.people[symbol] ?? [];
  // in page order; no "Overview": the page starts there, and five fit a phone (design review 5.6)
  const sections = [
    ledger && ["ask-docs", "Ask"],
    results && ["results", "Results"],
    ["promises", "Promises"],
    people.length > 0 && ["people", "People"],
    ["filings", "Filings"],
  ].filter(Boolean) as [string, string][];

  return (
    <main>
      <BackLink fallback="/" />

      <header id="overview" className="scroll-mt-16">
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
            {history && (
              <div className="mt-2 flex items-end gap-3">
                {/* price and filings in one first glance: a mark above the line on each day the company filed */}
                <MoveSpark rows={history} day={price.day} width={150} height={44} marks={marks} label={`${symbol}: the last 20 closes, each day's volume, and a mark on each day the company filed`} />
                <span className="pb-0.5 text-caption text-ink-3">
                  Last 20 sessions; bars are volume{marks.length ? <>; <Mark kind="filing" /> a filing</> : null}
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* no annual-report description: say what FINN does hold, as tags (three-pillars L2) */}
      {!(ledger?.snapshot && ledger.snapshot.what_they_do.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {results && <span className="tag">Results {fyQuarter(results.period_end)} checked</span>}
          {followed ? (
            <span className="tag num">
              {filings.length} filing{filings.length === 1 ? "" : "s"} in 30 days
            </span>
          ) : (
            <span className="tag">Filings not followed</span>
          )}
          {snap.network_status !== "unavailable" && (
            <span className="tag num">
              {people.length ? `${people.length} ${people.length === 1 ? "person" : "people"} you know` : "No one you know"}
            </span>
          )}
          {!ledger && <span className="tag">No promises ledger yet</span>}
        </div>
      )}

      {sections.length > 2 && <SectionNav sections={sections} />}

      {ledger?.snapshot && ledger.snapshot.what_they_do.length > 0 && (
        <section className="mt-10">
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
          {snap.trajectory?.[symbol] && <Trajectory t={snap.trajectory[symbol]} />}
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

      {/* FINN's three questions, then yours: Ask sits with "Worth your attention", in the first two screens,
          not after a ledger of up to 27 rows (design review 5.13) */}
      {ledger && <AskBox key={asked ?? ""} symbol={symbol} name={name.replace(/ Limited$/i, "")} examples={askExamples(ledger)} initial={asked} />}

      {results && (
        <section id="results" className="mt-12 scroll-mt-16">
          <h2 className="section-h">
            <span>Latest results</span>
            <span className="text-caption font-normal normal-case tracking-normal text-ink-3">{fyQuarter(results.period_end)}</span>
          </h2>
          {/* the picture, its question, then the exact table folded (layout plan §5) */}
          <ResultsVisual r={results} />
          {(() => {
            const q = resultsLink(symbol, snap);
            return q ? <QuestionCard question={q.text} href={q.href} /> : null;
          })()}
          <details className="group mt-6 border-t border-rule md:hidden">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-small text-ink-2">
              Exact figures, {fyQuarter(results.period_end)}
              <span aria-hidden className="text-ink-3 transition-transform duration-200 group-open:rotate-90">›</span>
            </summary>
            <ResultsTable r={results} />
          </details>
          <div className="mt-6 hidden md:block">
            <ResultsTable r={results} />
          </div>
        </section>
      )}

      <div id="promises" className="mt-12 scroll-mt-16">
        {/* research through an older call while a newer transcript exists: say so above the ledger (full review F05) */}
        {ledger && snap.ledger_index?.[symbol]?.newer_call && (
          <p className="mb-3 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
            <span className="font-medium text-ink">A newer call transcript was filed on {day(snap.ledger_index[symbol].newer_call + "T12:00:00", snap.data_until)}.</span> These
            promises read the calls through {ledger.calls[ledger.calls.length - 1]?.label}; FINN rebuilds the ledger with the new call at its next update.
          </p>
        )}
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
        <section id="people" className="mt-12 scroll-mt-16">
          <h2 className="section-h">People who&apos;d know</h2>
          {people.map((l, i) => (
            <NetworkLine
              key={l.contact_id}
              line={l}
              asOf={snap.data_until}
              reason={i === 0 && l.best_reason && l.best_reason !== l.relation ? l.best_reason : undefined}
              lens={lensLabel(snap.contacts.find((c) => c.id === l.contact_id), symbol)}
            />
          ))}
          {people.some((l) => l.insider) && <InsiderKey />}
        </section>
      )}

      {(
        <section id="filings" className="mt-12 scroll-mt-16">
          <h2 className="section-h">
            <span>Filings</span>
            <span className="text-caption font-normal normal-case tracking-normal text-ink-3">{followed ? "last 30 days" : "not followed"}</span>
          </h2>
          {!followed ? (
            <p className="py-3 text-small text-ink-2">
              FINN follows filings for your holdings and research list only, so this company&apos;s announcements aren&apos;t loaded here.{" "}
              <a href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`} target="_blank" rel="noopener noreferrer" className="tap text-accent">
                Its NSE page ↗︎
              </a>
            </p>
          ) : (
            filings.length === 0 && moves.length === 0 && <p className="py-3 text-small text-ink-2">No filings in the last 30 days.</p>
          )}
          <div className="hair">
            {/* the people above already cover this company: no repeated line under every filing */}
            {filings.map((c) => (
              <FilingRow key={c.id} id={c.id} kind={c.kind} at={c.at} title={c.headline ?? c.nse_subject} refTime={snap.data_until} />
            ))}
          </div>
          {/* near-identical move rows were noise: one line, opening the newest move (its card has the chart) */}
          {bigMoves.length > 0 ? (
            <Link href={`/card/${bigMoves[0].id}`} className="flex min-h-[48px] items-center justify-between border-t border-rule text-small text-ink">
              <span>
                Price moves: <span className="num">{bigMoves.length}</span> session{bigMoves.length === 1 ? "" : "s"} over 2% this month
              </span>
              <span aria-hidden className="text-accent">›</span>
            </Link>
          ) : volMoves.length > 0 ? (
            <Link href={`/card/${volMoves[0].id}`} className="flex min-h-[48px] items-center justify-between border-t border-rule text-small text-ink">
              <span>
                Volume: <span className="num">{volMoves.length}</span> session{volMoves.length === 1 ? "" : "s"} at 1.5× usual or more this month
              </span>
              <span aria-hidden className="text-accent">›</span>
            </Link>
          ) : null}
        </section>
      )}

      <About label="About this company">
        {ledger?.snapshot && (
          <AboutPart title="Business description">
            <p>
              From the FY{String(ledger.snapshot.year).slice(2)} annual report, pages {ledger.snapshot.pages[0]}–{ledger.snapshot.pages[1]}.{" "}
              <a href={ledger.snapshot.url} target="_blank" rel="noopener noreferrer" className="text-accent">
                Annual report ↗︎
              </a>
            </p>
          </AboutPart>
        )}
        {price && (
          <AboutPart title="Prices">
            <p>Closing prices and volume from NSE&apos;s daily bhavcopy, as traded (not adjusted for splits or bonuses).</p>
          </AboutPart>
        )}
        {ledger && (
          <AboutPart title="Promises">
            <p>{ledger.provenance.replace("Statuses computed in code.", "Statuses follow fixed rules, not a model's judgement.")}</p>
          </AboutPart>
        )}
      </About>
      <Dock askSymbol={ledger ? symbol : undefined} />
    </main>
  );
}

/** Two of the company's own tracked topics as example questions, then one every company answers. */
function askExamples(ledger: Ledger): string[] {
  const seen = new Set<string>();
  const topics = ledger.rows
    .map((r) => r.metric?.replace(/\s*\(.*?\)\s*/g, " ").trim())
    .filter((m): m is string => !!m && m.length <= 28 && !seen.has(m.toLowerCase()) && !!seen.add(m.toLowerCase()))
    .slice(0, 2);
  return [...topics.map((t) => t.charAt(0).toUpperCase() + t.slice(1)), "Demand outlook"];
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

/** Up to three questions worth the investor's attention, from the promises that changed (creative review,
 *  company hierarchy step 3), as compact rows: the serif headline belongs to the investigation itself
 *  (layout plan §5). A company with no ledger gets the gap itself as the row. */
function Questions({ symbol, snap, ledger }: { symbol: string; snap: Snapshot; ledger: Ledger | null }) {
  const out: { tag: string; q: string; href: string }[] = [];
  // the results question sits under the results chart, beside its evidence; these are the promise questions
  if (ledger) {
    const pick = (st: string[]) =>
      ledger.rows
        .filter((r) => st.includes(r.latest) && !/: (no figure|direction only)$/.test(r.title))
        .sort((a, b) => (b.mentions ?? 1) - (a.mentions ?? 1))[0];
    const revised = pick(["revised"]);
    if (revised) out.push({ tag: "Revised", q: fromPromise(revised, ledger, snap).question, href: promiseHref(symbol, revised) });
    const quiet = pick(["silent", "missed", "partly"]);
    if (quiet) out.push({ tag: quiet.latest === "silent" ? "Went quiet" : "Settled", q: fromPromise(quiet, ledger, snap).question, href: promiseHref(symbol, quiet) });
    const tracked = ledger.rows.find((r) => r.tracking);
    if (tracked) out.push({ tag: "On course?", q: fromPromise(tracked, ledger, snap).question, href: promiseHref(symbol, tracked) });
  } else {
    out.push({ tag: "Gap", q: "No promises ledger yet. Build one from the last four earnings calls", href: "#promises" });
  }
  if (!out.length) return null;
  return (
    <section className="mt-12" aria-labelledby="questions-h">
      <h2 id="questions-h" className="section-h">
        <span>Worth your attention</span>
        {ledger && <span className="text-caption font-normal normal-case tracking-normal text-ink-3">by fixed rules</span>}
      </h2>
      <ul className="hair">
        {out.slice(0, 3).map((x) => (
          <QuestionRow key={x.href} tag={x.tag} question={x.q} href={x.href} />
        ))}
      </ul>
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

/** A filing as one dense row (layout plan §5): what kind and when on a small line, the headline under it.
 *  The whole row opens the card. */
function FilingRow({ id, kind, at, title, refTime }: { id: string; kind: string; at: string; title: string; refTime: string }) {
  return (
    <Link href={`/card/${id}`} className="group block py-2.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="kicker text-ink-3">{KIND_LABEL[kind] ?? "Filing"}</span>
        <span className="num text-caption text-ink-3">{when(at, refTime)}</span>
      </span>
      <span className="mt-0.5 flex items-start justify-between gap-3">
        <span className="text-body text-ink group-hover:underline">{title}</span>
        <span aria-hidden className="go mt-0.5">›</span>
      </span>
    </Link>
  );
}

/** The one word that needs explaining, said once wherever an insider appears (three-pillars N2). */
function InsiderKey() {
  return (
    <p className="mt-2 text-caption text-ink-3">
      <span className="tag mr-1.5">Insider</span>works there now; ask only about what is public.
    </p>
  );
}

/** The first lens a contact's recorded role fits, as a word ("Execution"), or nothing. */

