"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "finn_intro_seen";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
};

/**
 * The map, once (three-pillars plan §2): one line naming the app's three parts in the order the doors sit,
 * shown on a device's first visit and gone after a tap. Nothing renders on the server, so a returning
 * visitor never sees it flash.
 */
export function FirstVisit() {
  const seen = useSyncExternalStore(() => () => {}, read, () => true);
  const [gone, setGone] = useState(false);
  if (seen || gone) return null;
  return (
    <p className="mt-2 rounded-lg bg-tint px-3 py-2 text-caption text-ink-2">
      FINN reads your holdings&apos; filings and ranks what matters; keeps each company&apos;s promises against its own later words; and shows
      who in your network can help. Set what counts in Rules. Real filings and prices; the people are synthetic.{" "}
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
          setGone(true);
        }}
        className="tap font-medium text-accent"
      >
        Got it
      </button>
    </p>
  );
}
