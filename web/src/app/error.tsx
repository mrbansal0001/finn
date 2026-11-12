"use client";

import Link from "next/link";

/** A data hiccup (the database waking up, a network blip) shouldn't show a bare error screen. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="pt-10">
      <h1 className="font-serif text-title">This edition didn&apos;t load</h1>
      <p className="mt-2 text-body text-ink-2">
        The data service didn&apos;t answer in time. It usually does on a second try.
      </p>
      <div className="mt-4 flex gap-4 text-body">
        <button onClick={reset} className="min-h-[44px] rounded-md bg-ink px-4 text-paper">Try again</button>
        <Link href="/" className="inline-flex min-h-[44px] items-center text-accent">Back to the edition</Link>
      </div>
    </main>
  );
}
