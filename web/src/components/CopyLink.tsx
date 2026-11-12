"use client";

import { useState } from "react";

/**
 * Investors forward things (three-pillars plan S1): copy this page's address, with a short toast that says
 * whether it worked. Lives inside every "About this …" fold.
 */
export function CopyLink() {
  const [state, setState] = useState<"" | "ok" | "failed">("");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            if (!navigator.clipboard) throw new Error("no clipboard");
            await navigator.clipboard.writeText(location.href);
            setState("ok");
          } catch {
            setState("failed");
          }
          setTimeout(() => setState(""), 2200);
        }}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-small font-medium text-accent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
        Copy link
      </button>
      {state && (
        <p
          role="status"
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-small text-paper shadow-lg"
        >
          {state === "ok" ? "Link copied" : "Couldn't copy here; copy it from the address bar"}
        </p>
      )}
    </>
  );
}
