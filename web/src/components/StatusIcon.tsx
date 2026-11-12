import type { PromiseStatus } from "@/lib/types";

/**
 * Promise status as drawn icons, one family (13 Nov). Unicode glyphs (◦ ◌ ○ — ↻ ◐ ⚠) rendered at the size and
 * weight of whatever font the phone had: ◦ was a speck, ◌ a faint dotted ring, and the two were nearly
 * indistinguishable. Issue trackers people scan all day (Linear, GitHub) use one fixed circle whose fill and inner
 * mark carry the state; the same here, so each state reads by shape alone (colour helps, never decides).
 *
 *   open       an empty ring: stated, its period still running
 *   revised    a circular arrow: the target changed
 *   silent     a ring with a dash: stated before, nothing said now
 *   closed     a ring with a question mark: the period ended and no outcome was stated
 *   partly     a half-filled ring: some of it came
 *   delivered  a filled circle with a tick: management's later figure says it happened
 *   missed     a ring with a cross: management's later figure falls short
 *   conflict   a warning triangle: two statements disagree
 *
 * `faint`: still open but not mentioned on that call. `missedFirst`: a revision made after the old date had passed,
 * marked with a small red dot rather than a second glyph.
 */
export const STATUS_META: Record<PromiseStatus, { word: string; short: string; color: string }> = {
  delivered: { word: "Delivered", short: "delivered", color: "var(--s-delivered)" },
  partly: { word: "Partly delivered", short: "partly", color: "var(--s-partly)" },
  missed: { word: "Missed", short: "missed", color: "var(--s-missed)" },
  revised: { word: "Revised", short: "revised", color: "var(--s-revised)" },
  silent: { word: "Went silent", short: "silent", color: "var(--s-silent)" },
  closed: { word: "Ended, no outcome stated", short: "ended", color: "var(--s-silent)" },
  early: { word: "Open", short: "open", color: "var(--s-early)" },
  conflict: { word: "Conflicting", short: "conflicting", color: "var(--s-partly)" },
};

export function StatusIcon({
  status,
  size = 16,
  faint = false,
  missedFirst = false,
  className = "",
  color,
}: {
  status: PromiseStatus;
  size?: number;
  faint?: boolean;
  missedFirst?: boolean;
  className?: string;
  color?: string; // override (the replay's active stop draws in paper on ink)
}) {
  const c = color ?? STATUS_META[status].color;
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{ color: c, opacity: faint ? 0.45 : 1 }}
    >
      {status === "early" && <circle cx="12" cy="12" r="8.5" {...stroke} />}
      {status === "revised" && (
        <>
          <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" {...stroke} />
          <path d="M20.5 3.5v4.5H16" {...stroke} />
        </>
      )}
      {status === "silent" && (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M8.5 12h7" {...stroke} />
        </>
      )}
      {status === "closed" && (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.1-2.4 3.2" {...stroke} strokeWidth={1.8} />
          <circle cx="12" cy="16.6" r="1.1" fill="currentColor" />
        </>
      )}
      {status === "partly" && (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
        </>
      )}
      {status === "delivered" && (
        <>
          <circle cx="12" cy="12" r="9.5" fill="currentColor" />
          <path d="m8 12.3 2.8 2.8L16.2 9.4" fill="none" stroke="var(--paper)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === "missed" && (
        <>
          <circle cx="12" cy="12" r="8.5" {...stroke} />
          <path d="m9 9 6 6m0-6-6 6" {...stroke} />
        </>
      )}
      {status === "conflict" && (
        <>
          <path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z" {...stroke} />
          <path d="M12 9.5v4" {...stroke} />
          <circle cx="12" cy="17" r="1.1" fill="currentColor" />
        </>
      )}
      {missedFirst && <circle cx="19.5" cy="4.5" r="3.6" fill="var(--s-missed)" stroke="var(--paper)" strokeWidth="1.6" />}
    </svg>
  );
}

/** Small drawn marks for captions, matching the shapes on the charts (instead of ▼ ◆ text glyphs). */
export function Mark({ kind, className = "" }: { kind: "filing" | "filing-after" | "exact" | "interval" | "check"; className?: string }) {
  if (kind === "check")
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden className={`inline-block shrink-0 align-[-2px] ${className}`}>
        <circle cx="12" cy="12" r="9.5" fill="var(--up)" />
        <path d="m8 12.3 2.8 2.8L16.2 9.4" fill="none" stroke="var(--paper)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "exact")
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`inline-block align-[0px] ${className}`}>
        <rect x="1.8" y="1.8" width="6.4" height="6.4" transform="rotate(45 5 5)" className="fill-ink-3" />
      </svg>
    );
  if (kind === "interval")
    return (
      <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden className={`inline-block align-[1px] ${className}`}>
        <rect x="0" y="1" width="16" height="6" rx="3" className="fill-ink-3/50" />
      </svg>
    );
  return (
    <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden className={`inline-block align-[1px] ${className}`}>
      <path d="M0.8 0.8h7.4L4.5 7.2z" className={kind === "filing-after" ? "fill-paper stroke-accent" : "fill-accent stroke-accent"} strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
