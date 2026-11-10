import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { parsePrefs, PREFS_COOKIE } from "@/lib/prefs";
import { SettingsForm } from "./SettingsForm";

export default function SettingsPage() {
  return (
    <main>
      <nav className="text-[0.875rem]">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-ink-2 hover:text-ink">
          ‹ Edition
        </Link>
      </nav>
      <h1 className="font-serif text-[1.75rem] leading-tight">What counts</h1>
      <p className="mt-1 text-[0.9375rem] text-ink-2">You decide what is unusual. FINN ranks and folds by these rules.</p>
      <Suspense fallback={<p className="mt-6 text-[0.8125rem] text-ink-3">Loading your rules…</p>}>
        <Current />
      </Suspense>
    </main>
  );
}

async function Current() {
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  return <SettingsForm prefs={prefs} />;
}
