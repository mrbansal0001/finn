"use client";

import type { ReactNode } from "react";

/** A link to a section on the same page that also opens it when it is a fold (the edition summary line). */
export function JumpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a
      href={`#${to}`}
      onClick={(e) => {
        const el = document.getElementById(to);
        if (!el) return;
        e.preventDefault();
        const fold = el.closest("details") ?? (el.tagName === "DETAILS" ? el : null);
        if (fold) (fold as HTMLDetailsElement).open = true;
        el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      }}
      className="text-ink underline decoration-rule underline-offset-2 hover:decoration-ink"
    >
      {children}
    </a>
  );
}
