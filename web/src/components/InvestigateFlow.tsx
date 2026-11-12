"use client";

import { useState, type ReactNode } from "react";
import type { LensKey } from "@/lib/lenses";
import type { NetworkLine } from "@/lib/types";
import { RelationPath, type Path } from "./RelationPath";
import { saveQuestion, type Revisit } from "./followed";

export type FlowPerson = { line: NetworkLine; basis: string; lenses: LensKey[]; path: Path; questions: Partial<Record<LensKey, string[]>> };
export type FlowLens = { key: LensKey; label: string; ask: string; roles: string };

/**
 * The investigation's moving parts (creative review, signature concept). The question is the investor's:
 * it starts from the rule-written one and can be edited; the people, the note and the saved question all
 * follow the edit, so nothing has to be re-typed on another page.
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
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [editing, setEditing] = useState(false);

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
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-ink-3 bg-paper-raised px-3.5 py-3 font-serif text-headline focus:border-accent focus:outline-none"
            />
            <div className="mt-1 flex gap-3">
              <button onClick={() => setEditing(false)} className="min-h-[44px] rounded-lg bg-ink px-4 text-small font-medium text-paper">
                Done
              </button>
              <button
                onClick={() => {
                  setQuestion(initialQuestion);
                  setEditing(false);
                }}
                className="min-h-[44px] px-2 text-small text-ink-2"
              >
                Use FINN&apos;s wording
              </button>
            </div>
          </div>
        ) : (
          <h1 className="font-serif text-title text-ink">
            {question}{" "}
            <button onClick={() => setEditing(true)} className="tap align-middle font-sans text-small font-normal text-accent">
              Edit
            </button>
          </h1>
        )}
        <p className="mt-2 text-caption text-ink-3">
          {question === initialQuestion ? "Written by FINN from the figures below, by fixed rules. A question, not a finding." : "Your wording."}
        </p>
      </div>

      <Step n={1} title="What changed">
        {observed}
      </Step>
      <Step n={2} title="What remains unclear">
        <p className="mt-2 text-body text-ink-2">{unclear}</p>
      </Step>
      {check}
      <People lenses={lenses} people={people} lensOrder={lensOrder} question={question} company={company} networkDown={networkDown} />
      <Follow symbol={symbol} company={company} title={title} question={question} initial={revisit} />
    </>
  );
}

export function Step({ n, title, children, aside }: { n: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-10">
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
}: {
  lenses: FlowLens[];
  people: FlowPerson[];
  lensOrder: LensKey[];
  question: string;
  company: string;
  networkDown: boolean;
}) {
  const count = (k: LensKey) => people.filter((p) => p.lenses.includes(k)).length;
  const first = lensOrder.find((k) => count(k) > 0) ?? lenses.find((l) => count(l.key) > 0)?.key ?? lensOrder[0];
  const [lens, setLens] = useState<LensKey>(first);
  const fits = people.filter((p) => p.lenses.includes(lens));
  const [pick, setPick] = useState(0);
  const person = fits[Math.min(pick, fits.length - 1)];
  const L = lenses.find((l) => l.key === lens)!;

  return (
    <Step n={4} title="Who could help">
      {networkDown ? (
        <p className="mt-2 text-small text-ink-2">Your network didn&apos;t load, so FINN can&apos;t suggest anyone. Reload to try again.</p>
      ) : people.length === 0 ? (
        <p className="mt-2 text-small text-ink-2">No one in your network has a recorded link to {company.replace(/ Limited$/, "")}.</p>
      ) : (
        <>
          <p className="mt-2 text-small text-ink-2">What are you trying to understand?</p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="What you want to understand">
            {lenses.map((l) => {
              const n = count(l.key);
              return (
                <button
                  key={l.key}
                  aria-pressed={lens === l.key}
                  onClick={() => {
                    setLens(l.key);
                    setPick(0);
                  }}
                  className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-small transition-colors ${
                    lens === l.key ? "bg-ink font-medium text-paper" : n ? "border border-rule text-ink-2 hover:text-ink" : "border border-dashed border-rule text-ink-3"
                  }`}
                >
                  {l.label}
                  <span className={`num text-caption ${lens === l.key ? "text-paper/70" : "text-ink-3"}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-caption text-ink-3">{L.label}: {L.ask}. Matched on each person&apos;s recorded role.</p>

          {!person ? (
            <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
              No one linked to this company in your network has a recorded {L.roles} role. FINN won&apos;t stretch a weaker match to
              fill the gap; try another lens.
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
                <RelationPath path={person.path} />
                <p className="mt-1 text-small text-ink-2">
                  <span className="text-ink-3">Why them for this: </span>
                  {person.basis}.
                  {person.line.insider ? " Works there now, so public information only." : ""}
                </p>
              </div>
              {/* a new person, lens or question starts a fresh draft */}
              <Note key={`${person.line.contact_id}|${lens}|${question}`} person={person} lens={lens} question={question} company={company} />
            </>
          )}
        </>
      )}
    </Step>
  );
}

function Note({ person, lens, question, company }: { person: FlowPerson; lens: LensKey; question: string; company: string }) {
  const qs = person.questions[lens] ?? [];
  const first = person.line.name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.)\s*(\(retd\.\)\s*)?/, "").split(" ")[0];
  const co = company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
  const via = person.line.via ? person.line.via.split(" ")[0] : null;
  const draft =
      via
        ? `Hi ${via}, I'm looking into ${co} and would value an introduction to ${first}, given ${person.basis.split(",")[0].toLowerCase()} experience. The question I'm working on: ${question}\n\nWould you be comfortable connecting us?`
        : `Hi ${first}, I'm looking into ${co}. The question I'm working on: ${question}\n\nFrom your time as ${person.basis}, I'd value your read on:\n${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nCould we speak for 15 minutes this week?`;
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
      <label htmlFor="inv-note" className="mt-4 block text-caption text-ink-3">
        {via ? `Ask ${via} for an introduction` : `A note to ${first}`} (edit, then copy; nothing is sent from FINN)
      </label>
      <textarea
        id="inv-note"
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
    </div>
  );
}

const REVISIT: { key: Revisit; label: string; hint: string }[] = [
  { key: "results", label: "Next results", hint: "when the next quarterly results are filed" },
  { key: "call", label: "Next earnings call", hint: "when the next call transcript or recording is filed" },
  { key: "filing", label: "Any new filing", hint: "when the company files anything new" },
  { key: "date", label: "On a date", hint: "on the day you choose" },
];

function Follow({ symbol, company, title, question, initial }: { symbol: string; company: string; title: string; question: string; initial: Revisit }) {
  const [revisit, setRevisit] = useState<Revisit>(initial);
  const [date, setDate] = useState("");
  const [saved, setSaved] = useState(false);
  const r = REVISIT.find((x) => x.key === revisit)!;
  return (
    <Step n={5} title="Keep following">
      <p className="mt-2 text-small text-ink-2">Bring this question back</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="When to bring it back">
        {REVISIT.map((x) => (
          <button
            key={x.key}
            role="radio"
            aria-checked={revisit === x.key}
            onClick={() => {
              setRevisit(x.key);
              setSaved(false);
            }}
            className={`min-h-[44px] rounded-full px-4 text-small ${revisit === x.key ? "bg-ink font-medium text-paper" : "border border-rule text-ink-2"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {revisit === "date" && (
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
          aria-label="Revisit on"
          className="mt-3 min-h-[44px] rounded-lg border border-ink-3 bg-paper-raised px-3 text-body"
        />
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={saved || (revisit === "date" && !date)}
          onClick={() => {
            saveQuestion({ symbol, company, title, question, revisit, date: revisit === "date" ? date : undefined, href: location.pathname + location.search });
            setSaved(true);
          }}
          className="min-h-12 rounded-lg bg-ink px-5 text-small font-medium text-paper disabled:opacity-60"
        >
          {saved ? "Following" : "Follow this question"}
        </button>
        <span role="status" className="text-caption text-ink-3">
          {saved ? "Saved. It appears at the top of your edition." : ""}
        </span>
      </div>
      <p className="mt-3 text-caption text-ink-3">
        FINN brings it back {r.hint}, checking each time you open the edition. Saved on this device only; it doesn&apos;t send
        notifications.
      </p>
    </Step>
  );
}
