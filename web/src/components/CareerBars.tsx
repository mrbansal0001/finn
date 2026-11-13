import Link from "next/link";
import type { Contact } from "@/lib/types";

/**
 * A career as bars on one time axis (creative review §3, "career overlap"): the same facts as the list,
 * but the years each role covered, and which overlap, are visible at a glance. Companies FINN covers are
 * links. Years only: the profile records months, but a phone row can't show them legibly.
 */
export function CareerBars({ history, until, covered }: { history: Contact["history"]; until: string; covered: string[] }) {
  if (!history.length) return null;
  const yr = (s: string) => Number(s.slice(0, 4)) + (Number(s.slice(5, 7) || 1) - 1) / 12;
  const end = yr(until.slice(0, 7));
  const lo = Math.floor(Math.min(...history.map((h) => yr(h.start))));
  const hi = Math.ceil(end);
  const x = (v: number) => `${(100 * (v - lo)) / (hi - lo)}%`;
  const rows = [...history].reverse();
  return (
    <div className="mt-3">
      <ol className="space-y-3">
        {rows.map((h, i) => {
          const s = yr(h.start), e = h.end ? yr(h.end) : end;
          const link = h.symbol && covered.includes(h.symbol);
          return (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3 text-small">
                <span className="min-w-0">
                  {h.role},{" "}
                  {link ? (
                    <Link href={`/c/${encodeURIComponent(h.symbol!)}`} className="tap text-accent hover:underline">
                      {h.org}
                    </Link>
                  ) : (
                    <span className="text-ink-2">{h.org}</span>
                  )}
                </span>
                <span className="num shrink-0 text-caption text-ink-3">
                  {h.start.slice(0, 4)}–{h.end ? h.end.slice(0, 4) : "now"}
                </span>
              </div>
              <div className="relative mt-1 h-2 rounded-full bg-tint" aria-hidden>
                <span
                  className={`absolute inset-y-0 rounded-full ${h.end ? "bg-mark" : "bg-accent"}`}
                  style={{ left: x(s), width: `calc(${x(e)} - ${x(s)})`, minWidth: "6px" }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      {/* one axis for every bar, ruled off so it doesn't read as the last bar's own label (design review 8.9) */}
      <p className="num mt-3 flex justify-between border-t border-rule pt-1 text-label text-ink-3" aria-hidden>
        <span>{lo}</span>
        <span>{Math.round((lo + hi) / 2)}</span>
        <span>{hi}</span>
      </p>
    </div>
  );
}
