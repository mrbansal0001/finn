"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import type { LensKey } from "@/lib/lenses";
import type { NetworkLine } from "@/lib/types";
import { RelationPath, type Path } from "./RelationPath";
import { SectionNav } from "./SectionNav";
import { CHANGED, dropQuestion, findByHref, saveQuestion, type Followed, type Revisit } from "./followed";

export type FlowPerson = { line: NetworkLine; basis: string; lenses: LensKey[]; path: Path; questions: Partial<Record<LensKey, string[]>> };
export type FlowLens = { key: LensKey; label: string; ask: string; roles: string };

// the saved record for this investigation, read from the browser without a hydration mismatch (server: none)
const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGED, cb);
    window.removeEventListener("storage", cb);
  };
};
function useSaved(): Followed | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(findByHref(location.pathname + location.search) ?? null),
    () => "null",
  );
  return JSON.parse(raw) as Followed | null;
}

const SECTIONS: [string, string][] = [
  ["s-change", "Change"],
  ["s-evidence", "Evidence"],
  ["s-people", "People"],
  ["s-follow", "Follow"],
];

/**
 * The investigation's moving parts (creative review; visual review §3.4, §10). The question is the
 * investor's: it starts from the rule-written one, can be edited, and a saved edit comes back on reload.
 * People, note and saved question all follow it. A small section navigator shortens the path down the page.
 */
export function InvestigateFlow({
  initialQuestion,
  symbol,
  company,
  title,
  observed,
  unclear,
  check,
  lenses,
  people,
  lensOrder,
  revisit,
  networkDown,
  peopleNote,
}: {
  initialQuestion: string;
  symbol: string;
  company: string;
  title: string;
  observed: ReactNode;
  unclear: string;
  check: ReactNode;
  lenses: FlowLens[];
  people: FlowPerson[];
  lensOrder: LensKey[];
  revisit: Revisit;
  networkDown: boolean;
  peopleNote?: string;
}) {
  const saved = useSaved();
  const [edited, setEdited] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const question = edited ?? saved?.question ?? initialQuestion;

  const go = (id: string) => {
    // the evidence lives in a side pane on wide screens: jump to whichever copy is visible
    const el = [...document.querySelectorAll<HTMLElement>(`[data-section="${id}"]`)].find((x) => x.offsetParent !== null);
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="mt-2">
        {editing ? (
          <div>
            <label htmlFor="q" className="sr-only">
              Your question
            </label>
            <textarea
              id="q"
              autoFocus
              value={question}
              onChange={(e) => setEdited(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-ink-3 bg-paper-raised px-3.5 py-3 font-serif text-headline focus:border-accent focus:outline-none"
            />
            <div className="mt-1 flex gap-3">
              <button onClick={() => setEditing(false)} className="min-h-[44px] rounded-lg bg-ink px-4 text-small font-medium text-paper">
                Done
              </button>
              <button
                onClick={() => {
                  setEdited(initialQuestion);
                  setEditing(false);
                }}
                className="min-h-[44px] px-2 text-small text-ink-2"
              >
                Use FINN&apos;s wording
              </button>
            </div>
          </div>
        ) : (
          <h1 className="font-serif text-headline text-ink min-[400px]:text-title">
            {question}{" "}
            <button onClick={() => setEditing(true)} className="tap align-middle font-sans text-small font-normal text-accent">
              Edit
            </button>
          </h1>
        )}
        <p className="mt-1.5 text-caption text-ink-3">
          {question === initialQuestion ? "Written by FINN from the figures below, by fixed rules. A question, not a finding." : "Your wording."}
          {saved && question !== saved.question ? " Not saved yet: follow it again to keep this wording." : ""}
        </p>
      </div>

      {/* the same sticky section bar as the company page: one component for "jump within this page"; pills
          are filters elsewhere, so they read as filters here too (design review 4.3) */}
      <SectionNav sections={SECTIONS} onGo={go} />

      {/* four steps, named as the navigator names them; what remains unclear closes step 1 (layout plan §6) */}
      <Step n={1} title="What changed" section="s-change">
        {observed}
        <p className="mt-4 text-small text-ink-2">
          <span className="font-medium text-ink">Still unclear: </span>
          {unclear}
        </p>
      </Step>
      {/* on wide screens the evidence sits in the side pane instead */}
      <div className="min-[1100px]:hidden">{check}</div>
      <People lenses={lenses} people={people} lensOrder={lensOrder} question={question} company={company} networkDown={networkDown} note={peopleNote} />
      <Follow symbol={symbol} company={company} title={title} question={question} initial={revisit} saved={saved} />
    </>
  );
}

export function Step({ n, title, children, aside, section }: { n: number; title: string; children: ReactNode; aside?: ReactNode; section?: string }) {
  return (
    <section className="mt-12 scroll-mt-4 focus:outline-none" data-section={section} tabIndex={section ? -1 : undefined}>
      <h2 className="section-h">
        <span className="flex items-baseline gap-2">
          <span className="num text-ink-3">{n}</span>
          {title}
        </span>
        {aside}
      </h2>
      {children}
    </section>
  );
}

function People({
  lenses,
  people,
  lensOrder,
  question,
  company,
  networkDown,
  note,
}: {
  lenses: FlowLens[];
  people: FlowPerson[];
  lensOrder: LensKey[];
  question: string;
  company: string;
  networkDown: boolean;
  note?: string;
}) {
  const count = (k: LensKey) => people.filter((p) => p.lenses.includes(k)).length;
  const anyFit = people.some((p) => p.lenses.length > 0);
  const first = lensOrder.find((k) => count(k) > 0) ?? lenses.find((l) => count(l.key) > 0)?.key ?? lensOrder[0];
  const [lens, setLens] = useState<LensKey>(first);
  const fits = anyFit ? people.filter((p) => p.lenses.includes(lens)) : people;
  const [pick, setPick] = useState(0);
  const person = fits[Math.min(pick, fits.length - 1)];
  const L = lenses.find((l) => l.key === lens)!;
  const co = company.replace(/ Limited$/, "");

  return (
    <Step n={3} title="Who could help" section="s-people">
      {networkDown ? (
        <p className="mt-2 text-small text-ink-2">Your network didn&apos;t load, so FINN can&apos;t suggest anyone. Reload to try again.</p>
      ) : people.length === 0 ? (
        <p className="mt-2 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
          {note ?? `No one in your network has a recorded link to ${co}.`}
        </p>
      ) : (
        <>
          {note && <p className="mt-2 text-caption text-ink-3">{note}</p>}
          {anyFit ? (
            <>
              {/* only lenses someone fits: an empty lens would be a control that does nothing (layout plan §6);
                  with a single lens there is nothing to choose, so it is said, not offered */}
              {lenses.filter((l) => count(l.key) > 0).length > 1 && (
              <>
              <p className="mt-2 text-small text-ink-2">What are you trying to understand?</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="What you want to understand">
                {lenses
                  .filter((l) => count(l.key) > 0)
                  .map((l) => (
                    <button
                      key={l.key}
                      aria-pressed={lens === l.key}
                      onClick={() => {
                        setLens(l.key);
                        setPick(0);
                      }}
                      className="pill"
                    >
                      {l.label}
                      <span className="num text-caption text-ink-3">{count(l.key)}</span>
                    </button>
                  ))}
              </div>
              </>
              )}
              {/* one line: which lens, and what it covers (design review 4.6) */}
              <p className="mt-2 text-caption text-ink-3">
                Matched on {L.label.toLowerCase()}: {L.ask}.
              </p>
            </>
          ) : (
            // a company connection exists, but nobody's recorded role fits a lens: say exactly that (§3.1)
            <p className="mt-2 text-small text-ink-2">
              {people.length} company connection{people.length === 1 ? "" : "s"}. No contact&apos;s recorded role specifically matches this question.
            </p>
          )}

          {!person ? (
            <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
              {people.length} company connection{people.length === 1 ? "" : "s"}, but none with a recorded {L.roles} role. FINN won&apos;t stretch a
              weaker match to fill the gap; try another lens.
            </p>
          ) : (
            <>
              {fits.length > 1 && (
                <div className="mt-4 flex gap-1.5 overflow-x-auto" role="group" aria-label="People">
                  {fits.map((p, i) => (
                    <button
                      key={p.line.contact_id}
                      aria-pressed={p === person}
                      onClick={() => setPick(i)}
                      className={`min-h-[44px] shrink-0 rounded-lg px-3 text-small ${p === person ? "bg-tint font-medium text-ink ring-1 ring-ink-3" : "text-ink-2"}`}
                    >
                      {p.line.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <RelationPath path={person.path} inline />
                {/* said only when it adds to the path's own edge text (an introducer, or a different role) */}
                {(person.line.via || !person.line.relation.toLowerCase().includes(person.basis.split(" at ")[0].toLowerCase())) && (
                  <p className="mt-1 text-small text-ink-2">
                    <span className="text-ink-3">Why them for this: </span>
                    {person.basis}.{person.line.insider ? " Works there now, so public information only." : ""}
                  </p>
                )}
                {!(person.line.via || !person.line.relation.toLowerCase().includes(person.basis.split(" at ")[0].toLowerCase())) && person.line.insider && (
                  <p className="mt-1 text-small text-ink-2">Works there now, so public information only.</p>
                )}
              </div>
              <Note key={`${person.line.contact_id}|${lens}|${question}`} person={person} lens={anyFit ? lens : null} question={question} company={company} />
            </>
          )}
        </>
      )}
    </Step>
  );
}

function Note({ person, lens, question, company }: { person: FlowPerson; lens: LensKey | null; question: string; company: string }) {
  const qs = (lens && person.questions[lens]) || Object.values(person.questions)[0] || [];
  const first = person.line.name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.)\s*(\(retd\.\)\s*)?/, "").split(" ")[0];
  const co = company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
  const via = person.line.via ? person.line.via.split(" ")[0] : null;
  const draft = via
    ? `Hi ${via}, I'm looking into ${co} and would value an introduction to ${first}, given ${person.basis.split(",")[0].toLowerCase()} experience. The question I'm working on: ${question}\n\nWould you be comfortable connecting us?`
    : `Hi ${first}, I'm looking into ${co}. The question I'm working on: ${question}\n\nFrom your time as ${person.basis}, I'd value your read on:\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nCould we speak for 15 minutes this week?`;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");

  return (
    <div className="mt-5">
      {!via && qs.length > 0 && (
        <>
          <p className="text-caption text-ink-3">Questions to ask {first}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-small text-ink">
            {qs.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </>
      )}
      {/* the draft stays folded until asked for: the page is long enough (visual review §3.4) */}
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-small font-medium text-accent">
          {via ? `Draft an introduction request to ${via}` : `Draft a note to ${first}`} <span aria-hidden>›</span>
        </button>
      ) : (
        <>
          <label htmlFor="inv-note" className="mt-4 block text-caption text-ink-3">
            {via ? `Ask ${via} for an introduction` : `A note to ${first}`} (edit, then copy; nothing is sent from FINN)
          </label>
          <textarea
            id="inv-note"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={via ? 5 : 9}
            className="mt-1.5 w-full rounded-lg border border-ink-3 bg-paper-raised px-3.5 py-3 text-small focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                if (!navigator.clipboard) throw new Error("no clipboard");
                await navigator.clipboard.writeText(text);
                setCopied("ok");
              } catch {
                setCopied("failed");
              }
              setTimeout(() => setCopied(""), 2500);
            }}
            className="mt-2 min-h-12 rounded-lg bg-ink px-5 text-small font-medium text-paper"
          >
            {copied === "ok" ? "Copied" : "Copy note"}
          </button>
          <span role="status" className="ml-3 text-caption text-ink-3">
            {copied === "failed" ? "Couldn't copy here; select the text instead." : ""}
          </span>
        </>
      )}
    </div>
  );
}

const REVISIT: { key: Revisit; label: string; hint: string }[] = [
  { key: "results", label: "Results", hint: "when the next quarterly results are filed" },
  { key: "call", label: "Call", hint: "when the next earnings-call transcript or recording is filed" },
  { key: "filing", label: "Any filing", hint: "when the company files anything new" },
  { key: "date", label: "A date", hint: "on the day you choose" },
];

function Follow({
  symbol,
  company,
  title,
  question,
  initial,
  saved,
}: {
  symbol: string;
  company: string;
  title: string;
  question: string;
  initial: Revisit;
  saved: Followed | null;
}) {
  // choices start from the saved record (so a reload shows what was chosen), else FINN's default
  const [choice, setChoice] = useState<Revisit | null>(null);
  const [dateIn, setDateIn] = useState<string | null>(null);
  const [resolveIn, setResolveIn] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const revisit = choice ?? saved?.revisit ?? initial;
  const date = dateIn ?? saved?.date ?? "";
  const resolve = resolveIn ?? saved?.resolve ?? "";
  const dirty = !!saved && (revisit !== saved.revisit || date !== (saved.date ?? "") || resolve !== (saved.resolve ?? "") || question !== saved.question);
  const r = REVISIT.find((x) => x.key === revisit)!;

  return (
    <Step n={4} title="Keep following" section="s-follow">
      <p className="mt-2 text-small text-ink-2">Bring this question back</p>
      <div className="seg mt-2" role="radiogroup" aria-label="When to bring it back">
        {REVISIT.map((x) => (
          <button
            key={x.key}
            role="radio"
            aria-checked={revisit === x.key}
            onClick={() => setChoice(x.key)}
            aria-label={x.key === "date" ? "On a date" : `Next ${x.label.toLowerCase()}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {revisit === "date" && (
        <input
          type="date"
          value={date}
          onChange={(e) => setDateIn(e.target.value)}
          aria-label="Revisit on"
          className="mt-3 min-h-[44px] rounded-lg border border-ink-3 bg-paper-raised px-3 text-body"
        />
      )}
      <label htmlFor="resolve" className="mt-4 block text-caption text-ink-3">
        What evidence would resolve this? (optional, your own test)
      </label>
      <input
        id="resolve"
        value={resolve}
        onChange={(e) => setResolveIn(e.target.value)}
        placeholder="e.g. the notes explain it"
        className="mt-1 min-h-[44px] w-full rounded-lg border border-rule bg-paper-raised px-3 text-small placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          disabled={(!!saved && !dirty) || (revisit === "date" && !date)}
          onClick={() => {
            const ok = saveQuestion({
              symbol, company, title, question, revisit, date: revisit === "date" ? date : undefined,
              resolve: resolve.trim() || undefined, href: location.pathname + location.search,
            });
            setError(!ok);
            if (ok) {
              setChoice(null);
              setDateIn(null);
              setResolveIn(null);
            }
          }}
          className="min-h-12 rounded-lg bg-ink px-5 text-small font-medium text-paper disabled:opacity-60"
        >
          {!saved ? "Follow this question" : dirty ? "Save changes" : "Following"}
        </button>
        {saved && (
          <>
            <Link href="/questions" className="min-h-[44px] content-center text-small text-accent">
              All questions ›
            </Link>
            <button onClick={() => dropQuestion(saved.id)} className="min-h-[44px] px-1 text-small text-ink-3 hover:text-ink">
              Stop following
            </button>
          </>
        )}
      </div>
      {/* one caption: what happens, and the honest limits (layout plan §6) */}
      <p role="status" className="mt-2 text-caption text-ink-3">
        {error
          ? "This browser didn't let FINN save it (private browsing or storage full). Nothing was kept."
          : `${saved && !dirty ? `Saved ${new Date(saved.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. ` : ""}Brings it back ${r.hint}; checked when you open FINN; this device only.`}
      </p>
      {/* saved: the way back to where the reader came from (three-pillars S8) */}
      {saved && !dirty && (
        <Link href="/" className="mt-1 inline-flex min-h-[44px] items-center text-small font-medium text-accent">
          Back to the edition ›
        </Link>
      )}
    </Step>
  );
}
