import type { ReactNode } from "react";
import { CopyLink } from "./CopyLink";

/** The one disclaimer, in the same words everywhere (layout plan §9.6). */
export const SYNTHETIC = "Filings and prices are real. The people are synthetic profiles for this prototype.";

/**
 * The meta block (layout plan §9.1): one collapsed "About this …" at the foot of a detail page, holding what is
 * reference rather than reading matter: sources, why it is here, methodology and provenance, the disclaimer.
 * It replaces three or four rule-headed sections per page.
 */
export function About({ label, children, disclaimer = true }: { label: string; children?: ReactNode; disclaimer?: boolean }) {
  return (
    <details className="group mt-12 border-t border-rule">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-small text-ink-2">
        {label}
        <span aria-hidden className="text-ink-3 transition-transform duration-200 group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="space-y-4 pb-4 text-caption text-ink-3">
        {/* investors forward things: the page's address, one tap (three-pillars S1) */}
        <CopyLink />
        {children}
        {disclaimer && <p>{SYNTHETIC}</p>}
      </div>
    </details>
  );
}

/** A labelled group inside the meta block. */
export function AboutPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-medium text-ink-2">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
