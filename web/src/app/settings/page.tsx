import { BackLink } from "@/components/BackLink";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { parsePrefs, PREFS_COOKIE } from "@/lib/prefs";
import { SettingsForm, type PreviewData } from "./SettingsForm";
import { getSnapshot } from "@/lib/data";

export const metadata = { title: "What counts" };

export default function SettingsPage() {
  return (
    <main>
      <BackLink fallback="/" />
      <h1 className="font-serif text-display">What counts</h1>
      <p className="mt-1 text-body text-ink-2">You decide what is unusual. FINN ranks and folds by these rules.</p>
      <Suspense fallback={<p className="mt-6 text-caption text-ink-3">Loading your rules…</p>}>
        <Current />
      </Suspense>
    </main>
  );
}

async function Current() {
  const [jar, snap] = await Promise.all([cookies(), getSnapshot()]);
  const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
  // every session over the lowest allowed thresholds, so the preview can apply any rule in the browser
  const preview: PreviewData = {
    windows: (["24h", "7d"] as const).map((k) => ({ key: k, since: snap.editions[k].since, until: snap.editions[k].until })),
    moves: (snap.move_cards ?? []).map((c) => {
      const f = c.facts as { change_pct?: number; volume_multiple?: number };
      return { s: c.symbol, at: c.at, p: f.change_pct ?? 0, v: f.volume_multiple ?? 0 };
    }),
  };
  return <SettingsForm prefs={prefs} preview={preview} />;
}
