"use client";

import { useState, useSyncExternalStore } from "react";

const KEY = "finn_theme";

/** The theme in effect: the visitor's saved choice, else the phone's setting. */
function current(): "light" | "dark" {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light / dark switch in the masthead. Starts by following the phone; once tapped, the choice is saved on
 * this device (applied before paint by the layout's early script, so there's no flash on the next visit).
 */
export function ThemeToggle() {
  const initial = useSyncExternalStore(() => () => {}, current, () => "light" as const);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const t = theme ?? initial;
  const next = t === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch {}
        setTheme(next);
      }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
    >
      {t === "dark" ? (
        // sun: switch to light
        <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
        </svg>
      ) : (
        // moon: switch to dark
        <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" />
        </svg>
      )}
    </button>
  );
}
