"use client";

import { useState } from "react";

/** A short, editable outreach note. Template-based: contact data never goes to a model. */
export function NoteDraft({ name, company, topic }: { name: string; company: string; topic: string }) {
  const first = name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.)\s*(\(retd\.\)\s*)?/, "").split(" ")[0];
  const [text, setText] = useState(
    `Hi ${first}, hope you're well. ${company.replace(/ Limited$/, "")}: "${topic}". You know this far better than I do. Could I take 15 minutes of your view this week?`,
  );
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
