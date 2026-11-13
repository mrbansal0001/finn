import type { ReactNode } from "react";

/**
 * One of the edition's three doors, as a tile (13 Nov, after a user couldn't tell the pills were links):
 * an icon that says what is inside, the name with the chevron that means "opens", and what it holds in plain
 * words. Used inside a <button> (Portfolio opens a sheet) or a <Link> (Research, People open pages).
 */
export function DoorTile({ icon, label, sub }: { icon: "portfolio" | "research" | "people"; label: string; sub: ReactNode }) {
  return (
    <>
      {/* the name gets the whole top line; the chevron closes the tile on the line below */}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="max-[359px]:hidden">
          <Icon kind={icon} />
        </span>
        <span className="min-w-0 truncate text-small font-medium text-ink max-[359px]:text-caption">{label}</span>
      </span>
      <span className="mt-0.5 flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-left text-caption text-ink-2 max-[359px]:text-label">{sub}</span>
        <span aria-hidden className="go ml-auto text-small leading-none">›</span>
      </span>
    </>
  );
}

export const DOOR_CLASS =
  "flex min-h-[3.5rem] min-w-0 flex-1 flex-col justify-center rounded-xl border border-rule bg-paper-raised px-3 py-2 text-left max-[359px]:px-2 transition-colors hover:border-accent active:bg-tint";

function Icon({ kind }: { kind: "portfolio" | "research" | "people" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0 text-accent">
      {kind === "portfolio" && (
        <>
          <rect x="3" y="7" width="18" height="13" rx="2" {...p} />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12h18" {...p} />
        </>
      )}
      {kind === "research" && (
        <>
          <path d="M6 3h9l3 3v15H6z" {...p} />
          <path d="M9 10h6M9 14h6M9 18h4" {...p} />
        </>
      )}
      {kind === "people" && (
        <>
          <circle cx="9" cy="8" r="3.2" {...p} />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" {...p} />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.5a5 5 0 0 1 2.5 5.5" {...p} />
        </>
      )}
    </svg>
  );
}
