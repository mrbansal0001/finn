"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "finn_cb";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Colour-blind-friendly directions (plan §6.2): blue for up, orange for down. A per-device display choice,
 * applied at once and remembered in this browser; the + and − signs carry direction either way.
 */
export function ColourToggle() {
  const stored = useSyncExternalStore(() => () => {}, read, () => false);
  const [on, setOn] = useState<boolean | null>(null);
  const value = on ?? stored;
  return (
    <label className="flex min-h-[56px] items-center justify-between gap-3 py-2">
      <span>
        <span className="block text-body">Colour-blind friendly</span>
        <span className="block text-caption text-ink-3">
          Blue for up, orange for down, on this device:{" "}
          <span className="num font-medium text-up">+2.1%</span> <span className="num font-medium text-down">−1.4%</span>
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(e) => {
          const v = e.target.checked;
          setOn(v);
          try {
            localStorage.setItem(KEY, v ? "1" : "0");
          } catch {}
          if (v) document.documentElement.dataset.cb = "1";
          else delete document.documentElement.dataset.cb;
        }}
        className="switch"
      />
      <span className="sr-only" aria-live="polite">
        {value ? "Blue and orange directions on" : "Green and red directions on"}
      </span>
    </label>
  );
}
