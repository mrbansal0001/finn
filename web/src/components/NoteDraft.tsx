"use client";

import { useState } from "react";

/** A short, editable outreach note. Template-based: contact data never goes to a model. */
export function NoteDraft({ name, company, topic, kind, role }: { name: string; company: string; topic: string; kind?: string; role?: string }) {
  const first = name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.)\s*(\(retd\.\)\s*)?/, "").split(" ")[0];
  const co = company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
  const fact = topic.charAt(0).toLowerCase() + topic.slice(1);
  // one natural sentence per kind of event; the visitor edits it before sending (nothing is sent from here)
  const what =
    kind === "results" ? `I saw ${co}'s results: ${fact}.`
      : kind === "management_change" ? `I saw the news from ${co}: ${topic}.`
        : kind === "m_and_a" ? `${co} has announced a deal: ${topic}.`
          : kind === "move" ? `${co}'s stock moved sharply (${fact}).`
            : kind === "litigation" ? `I saw ${co}'s legal update: ${topic}.`
              : kind === "fund_raise" ? `${co} is raising capital: ${topic}.`
                : `I saw ${co}'s update: ${topic}.`;
  const why = role ? `You'd know the context better than most, from your time as ${role}.` : "I'd value your read on what it means.";
  const [text, setText] = useState(`Hi ${first}, ${what} ${why} Could we speak for 15 minutes this week?`);
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  return (
    <div className="mt-4">
      <label htmlFor="note" className="text-meta text-ink-3">
        Draft a note (edit it, then copy; nothing is sent from FINN)
      </label>
      <textarea
        id="note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="mt-1 w-full rounded-md border border-ink-3 bg-paper-raised p-3 text-body focus:border-accent focus:outline-none"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            if (!navigator.clipboard) throw new Error("no clipboard");
            await navigator.clipboard.writeText(text);
            setCopied("ok");
          } catch {
            setCopied("failed");                 // say so; never claim a copy that didn't happen
          }
          setTimeout(() => setCopied(""), 2500);
        }}
        className="mt-2 min-h-[44px] rounded-md bg-ink px-5 text-small text-paper"
      >
        {copied === "ok" ? "Copied" : "Copy"}
      </button>
      <span role="status" className="ml-3 text-meta text-ink-3">
        {copied === "failed" ? "Couldn't copy here; select the text instead." : ""}
      </span>
    </div>
  );
}
