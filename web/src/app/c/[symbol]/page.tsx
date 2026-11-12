import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { notFound } from "next/navigation";
import { Dock } from "@/components/Dock";
import { Suspense } from "react";
import { getLedger, getRequest, getUniverse, getView } from "@/lib/data";
import { RequestButton } from "./RequestButton";
import { arrow, dirClass, pct, when } from "@/lib/format";
import { EditionCard } from "@/components/EditionCard";
import { PromisesLedger } from "@/components/PromisesLedger";
import { ResultsTable } from "@/components/ResultsTable";
import { NetworkLine } from "@/components/NetworkLine";

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
        {close.length > 0 && (
          <ul className="mt-3 text-body">
            {close.map(([s, n]) => (
              <li key={s} className="py-1">
                <Link href={`/c/${s}`} className="text-accent">{s}</Link> <span className="text-ink-2">{n}</span>
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
        <p className="kicker text-ink-3">
          {symbol}
          {holding ? ` · ${holding.sector} · ${holding.weight}% of portfolio` : snap.research_set.includes(symbol) ? " · research list" : ""}
        </p>
        <h1 className="mt-1 font-serif text-display">{name.replace(/ Limited$/, "")}</h1>
        {price && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-body">
            <span className="num font-medium">₹{price.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            <span className={`num ${dirClass(price.change_pct)}`}>
              {pct(price.change_pct)}
              <span aria-hidden className="ml-0.5 text-[0.7em]">{arrow(price.change_pct)}</span>
            </span>
            <span className="text-small text-ink-3">
              close <span className="num">{when(price.day + "T15:30:00")}</span>
            </span>
          </p>
        )}
      </header>

      {sections.length > 2 && (
        <nav aria-label="On this page" className="-mx-1 mt-4 flex gap-1 overflow-x-auto">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full border border-rule px-3 text-small text-ink-2 hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
      )}

      {ledger?.snapshot && ledger.snapshot.what_they_do.length > 0 && (
        <section className="mt-7">
          <h2 className="section-h">What they do · FY{String(ledger.snapshot.year).slice(2)} annual report</h2>
          <ul className="mt-2.5 space-y-2 text-body">
            {ledger.snapshot.what_they_do.slice(0, 2).map((x, i) => (
              <li key={i}>
                {x.text}{" "}
                <a href={`${ledger.snapshot!.url}#page=${x.page}`} target="_blank" rel="noopener noreferrer" className="tap num text-meta text-accent">
                  AR p.{x.page}
                </a>
              </li>
            ))}
          </ul>
          {(ledger.snapshot.what_they_do.length > 2 || ledger.snapshot.segments.length > 0) && (
            <details className="group mt-1">
              <summary className="inline-flex min-h-[40px] items-center gap-1 text-small text-accent">
                More, with segments <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>
              </summary>
              <ul className="space-y-2 text-body">
                {ledger.snapshot.what_they_do.slice(2).map((x, i) => (
                  <li key={i}>
                    {x.text}{" "}
                    <a href={`${ledger.snapshot!.url}#page=${x.page}`} target="_blank" rel="noopener noreferrer" className="tap num text-meta text-accent">
                      AR p.{x.page}
                    </a>
                  </li>
                ))}
              </ul>
              {ledger.snapshot.segments.length > 0 && (
                <p className="mt-2 text-small text-ink-2">
                  Segments:{" "}
                  {ledger.snapshot.segments
                    .map((g) => `${g.name}${g.share_of_revenue_pct != null ? ` (${g.share_of_revenue_pct}% of revenue)` : ""}`)
                    .join(" · ")}
                </p>
              )}
            </details>
          )}
        </section>
      )}

      {results && (
        <section id="results" className="mt-9 scroll-mt-4">
          <h2 className="section-h">Latest results</h2>
          <ResultsTable r={results} />
        </section>
      )}

      <div id="promises" className="mt-9 scroll-mt-4">
        {ledger ? (
          <PromisesLedger ledger={ledger} verifiers={snap.verifiers} />
        ) : (
          <section>
            <h2 className="section-h">Promised vs delivered</h2>
            <p className="mt-3 text-body text-ink-2">
              Built from the last four earnings-call transcripts and the annual report, nothing else. Every promise is quoted
              with its page; statuses are computed in code.
            </p>
            <Coverage symbol={symbol} req={req} dataUntil={snap.data_until} />
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
          <h2 className="section-h">Filings and moves · last 30 days</h2>
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
    return <p className="mt-3 text-body text-ink-2">{req.detail ?? "Not enough primary material to build a ledger."}</p>;
  }
  if (req?.status === "ready") {
    return <p className="mt-3 text-body text-ink-2">Built. The ledger appears here within a few minutes as the cache refreshes.</p>;
  }
  if (req) {
    return (
      <p className="mt-3 text-body text-ink-2">
        {req.status === "building" ? "Building now" : "Queued"} since <span className="num">{when(req.requested_at)}</span> IST. FINN&apos;s
        research worker reads the last four transcripts, verifies every quote against its page and computes each status on its
        next run (data last updated <span className="num">{when(dataUntil)}</span> IST).
        {req.detail ? <span className="block text-small italic text-ink-3">{req.detail}</span> : null}
      </p>
    );
  }
  return <RequestButton symbol={symbol} />;
}
