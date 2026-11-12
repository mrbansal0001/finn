"use client";

import { useState, useSyncExternalStore } from "react";

type Choice = "system" | "light" | "dark";
const KEY = "finn_theme";
const read = (): Choice => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};

/** Remember the choice and apply it to the page at once. */
function apply(c: Choice) {
  try {
    if (c === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, c);
  } catch {}
  const root = document.documentElement;
  if (c === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", c);
}

/**
 * Theme, beside the colour-blind choice so both display settings live together (layout plan §8). Follow the
 * phone, or fix light or dark; applied at once and remembered on this device (the layout's early script reads
 * the same key, so there is no flash on the next visit).
 */
export function ThemeChoice() {
  const stored = useSyncExternalStore(() => () => {}, read, () => "system" as Choice);
  const [choice, setChoice] = useState<Choice | null>(null);
  const value = choice ?? stored;
  const set = (c: Choice) => {
    setChoice(c);
    apply(c);
  };
  return (
    <div className="py-3">
      <p className="text-body">Theme</p>
      <div className="seg seg-sm mt-2" role="radiogroup" aria-label="Theme">
        {(
          [
            ["system", "Follow phone"],
            ["light", "Light"],
            ["dark", "Dark"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={value === k} onClick={() => set(k)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
