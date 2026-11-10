import Link from "next/link";
import { Suspense } from "react";
import { getLedger, getRequest, getUniverse, getView } from "@/lib/data";
import { requestCoverage } from "./actions";
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
          <p className="min-h-[44px] content-center text-[0.875rem] text-ink-3">‹ Edition</p>
          <p className="mt-1 text-[0.8125rem] text-ink-3">Opening dossier…</p>
        </main>
      }
    >
      <Company params={params} />
    </Suspense>
  );
}

async function Company({ params }: { params: PageProps<"/c/[symbol]">["params"] }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const [snap, ledger, uni, req] = await Promise.all([getView(), getLedger(symbol), getUniverse(), getRequest(symbol)]);
  const listed = uni.find(([s]) => s === symbol);
  if (!listed) {
    const close = uni.filter(([s, n]) => s.startsWith(symbol.slice(0, 3)) || n.toUpperCase().includes(symbol)).slice(0, 5);
    return (
      <main>
        <nav className="text-[0.875rem]">
          <Link href="/" className="inline-flex min-h-[44px] items-center text-ink-2 hover:text-ink">‹ Edition</Link>
        </nav>
        <h1 className="font-serif text-[1.5rem]">No NSE equity called {symbol}</h1>
        {close.length > 0 && (
          <ul className="mt-3 text-[0.9375rem]">
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
  const all = [...snap.editions["30d"].leads, ...snap.editions["30d"].more].filter((c) => c.symbol === symbol);
  const filings = all.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <main>
      <nav className="text-[0.875rem]">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-ink-2 hover:text-ink">
          ‹ Edition
        </Link>
      </nav>

      <header>
        <p className="kicker text-ink-3">
          {symbol}
          {holding ? ` · ${holding.sector} · ${holding.weight}% of portfolio` : snap.research_set.includes(symbol) ? " · research list" : ""}
        </p>
        <h1 className="mt-1 font-serif text-[1.75rem] leading-tight">{name.replace(/ Limited$/, "")}</h1>
        {price && (
          <p className="num mt-1 text-[0.9375rem]">
            ₹{price.close.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
            <span className={dirClass(price.change_pct)}>
              {pct(price.change_pct)} {arrow(price.change_pct)}
            </span>{" "}
            <span className="text-[0.8125rem] text-ink-3">close {when(price.day + "T15:30:00")}</span>
          </p>
        )}
      </header>

      {ledger ? (
        <div className="mt-8">
          <PromisesLedger ledger={ledger} verifiers={snap.verifiers} />
        </div>
      ) : (
        <section className="mt-8">
          <h2 className="kicker border-b border-ink pb-2">Promised vs delivered</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            Built from the last four earnings-call transcripts and the annual report, nothing else. Every promise is quoted
            with its page; statuses are computed against filed numbers where they exist.
          </p>
          <Coverage symbol={symbol} req={req} />
        </section>
      )}

      {(snap.people[symbol]?.length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="kicker border-b border-ink pb-2">People who&apos;d know</h2>
          {snap.people[symbol].map((l) => (
            <NetworkLine key={l.contact_id} line={l} asOf={snap.data_until} />
          ))}
        </section>
      )}

      {results && (
        <section className="mt-10">
          <h2 className="kicker border-b border-ink pb-2">Latest results</h2>
          <ResultsTable r={results} />
        </section>
      )}

      {filings.length > 0 && (
        <section className="mt-10">
          <h2 className="kicker border-b border-ink pb-2">Filings · last 30 days</h2>
          <div className="hair">
            {filings.map((c) => (
              <EditionCard key={c.id} card={c} refTime={snap.data_until} compact />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Coverage({ symbol, req }: { symbol: string; req: Awaited<ReturnType<typeof getRequest>> }) {
  if (req?.status === "unavailable") {
    return <p className="mt-3 text-[0.9375rem] text-ink-2">{req.detail ?? "Not enough primary material to build a ledger."}</p>;
  }
  if (req) {
    return (
      <p className="mt-3 text-[0.9375rem] text-ink-2">
        Queued <span className="num text-ink-3">{req.requested_at.slice(0, 16).replace("T", " ")}</span>. The research worker
        reads the last four transcripts, verifies every quote against its page and computes each status.
        {req.detail ? <span className="block text-[0.8125rem] italic text-ink-3">{req.detail}</span> : null}
      </p>
    );
  }
  return (
    <form action={requestCoverage} className="mt-4">
      <input type="hidden" name="symbol" value={symbol} />
      <button type="submit" className="min-h-[44px] rounded-md bg-ink px-4 text-[0.9375rem] text-paper">
        Build this ledger
      </button>
      <p className="mt-2 text-[0.8125rem] text-ink-3">Not covered yet. Built from primary sources only; usually ready within the hour.</p>
    </form>
  );
}
