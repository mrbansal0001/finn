"use client";

import { useState } from "react";

/** A short, editable outreach note. Template-based: contact data never goes to a model. */
export function NoteDraft({ name, company, topic, kind, role }: { name: string; company: string; topic: string; kind?: string; role?: string }) {
  const first = name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.)\s*(\(retd\.\)\s*)?/, "").split(" ")[0];
  const co = company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
  const fact = topic.charAt(0).toLowerCase() + topic.slice(1);
  const what =
    kind === "results" ? `I saw ${co}'s results: ${fact}.`
      : kind === "management_change" ? `I saw the news from ${co}: ${topic}.`
        : kind === "m_and_a" ? `${co} just announced that ${fact}.`
          : `${co} filed something I'm trying to read properly: ${topic}.`;
  const why = role ? `You'd know the context better than most, from your time as ${role}.` : "I'd value your read on it.";
  const [text, setText] = useState(`Hi ${first}, ${what} ${why} Could we speak for 15 minutes this week?`);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4">
      <label htmlFor="note" className="text-[0.75rem] text-ink-3">
        Draft a note
      </label>
      <textarea
        id="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="mt-1 w-full rounded-md border border-ink-3 bg-paper-raised p-2 text-[1rem] leading-relaxed focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="mt-1 min-h-[40px] rounded-md bg-ink px-4 text-[0.875rem] text-paper"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
