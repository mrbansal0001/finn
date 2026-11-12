"use client";

import { useSyncExternalStore } from "react";

/**
 * Says so when the data is old (three-pillars plan P2): FINN's reader runs on one machine every 15 minutes,
 * and when it is offline the edition keeps showing the last snapshot. Shown only on weekdays 09:00–20:00 IST
 * (when filings arrive) and when the last successful read is more than three hours old. Computed in the
 * browser, so the server never reads the clock.
 */
export function StaleNote({ lastOk }: { lastOk: string | null }) {
  const msg = useSyncExternalStore(
    () => () => {},
    () => {
      if (!lastOk) return "";
      const t = Date.parse(/[+Z]/.test(lastOk.slice(10)) ? lastOk : `${lastOk}+05:30`);
      const now = new Date();
      const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const weekday = ist.getDay() >= 1 && ist.getDay() <= 5;
      const hours = ist.getHours();
      const age = (now.getTime() - t) / 3_600_000;
      if (!weekday || hours < 9 || hours >= 20 || age <= 3) return "";
      return `Last updated ${Math.round(age)} hours ago; FINN's reader is offline, so newer filings aren't in yet.`;
    },
    () => "",
  );
  if (!msg) return null;
  return (
    <p className="mt-2 flex items-start gap-2 text-caption text-ink-2" role="status">
      <span aria-hidden className="mt-1 inline-block size-2 shrink-0 rounded-full bg-[var(--s-partly)]" />
      {msg}
    </p>
  );
}
