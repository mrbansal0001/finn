import { BackLink } from "@/components/BackLink";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { parsePrefs, PREFS_COOKIE } from "@/lib/prefs";
import { SettingsForm } from "./SettingsForm";

export default function SettingsPage() {
  return (
    <main>
      <BackLink fallback="/" />
      <h1 className="font-serif text-display leading-tight">What counts</h1>
      <p className="mt-1 text-body text-ink-2">You decide what is unusual. FINN ranks and folds by these rules.</p>
      <Suspense fallback={<p className="mt-6 text-small text-ink-3">Loading your rules…</p>}>
        <Current />
      </Suspense>
    </main>
  );
}

async function Current() {
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  return <SettingsForm prefs={prefs} />;
}
