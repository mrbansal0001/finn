"use client";

import { useActionState } from "react";
import { requestCoverage, type RequestState } from "./actions";

/** "Build this ledger": shows what happened (queued, already queued, refused) instead of failing silently. */
export function RequestButton({ symbol }: { symbol: string }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestCoverage, null);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="symbol" value={symbol} />
      <button type="submit" disabled={pending} className="min-h-[44px] rounded-md bg-ink px-4 text-body text-paper disabled:opacity-60">
        {pending ? "Requesting…" : "Build this ledger"}
      </button>
      <p className="mt-2 text-small text-ink-3" role="status">
        {state?.message ??
          "Not covered yet. Built from the last four transcripts only, on the research worker's next run."}
      </p>
    </form>
  );
}
