import type { MarginPlot } from "@/lib/investigate";
import { bp } from "@/lib/format";

/**
 * EBITDA margin a year ago, last quarter and now, one row each on a shared axis that starts at zero
 * (creative review §7). Zero-based on purpose: a 9bp change should look as small as it is. Only filed
 * figures, only the same basis (consolidated or standalone, as filed), never a target next to an outcome.
 */
export function MarginDots({ m }: { m: MarginPlot }) {
  const max = Math.max(...m.points.map((p) => p.value));
  const top = Math.max(5, Math.ceil((max * 1.15) / 5) * 5);
  if (m.points.some((p) => p.value < 0)) return null; // a negative margin needs a different picture
  return (
    <figure className="mt-5">
      <figcaption className="flex items-baseline justify-between text-caption text-ink-3">
        <span>EBITDA margin</span>
        <span className={`num font-medium ${m.change > 0 ? "text-up" : m.change < 0 ? "text-down" : "text-ink-2"}`}>{bp(m.change)} from a year ago</span>
      </figcaption>
      <ul className="mt-2 space-y-1.5">
        {m.points.map((p, i) => {
          const now = i === m.points.length - 1;
          return (
            <li key={p.label} className="grid grid-cols-[6.5rem_1fr_3.25rem] items-center gap-2 text-caption">
              <span className={now ? "font-medium text-ink" : "text-ink-3"}>{p.label}</span>
              <span className="relative h-5" aria-hidden>
                <span className="absolute inset-x-0 top-1/2 border-t border-rule" />
                <span
                  className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${now ? "bg-ink" : "border-2 border-ink-3 bg-paper"}`}
                  style={{ left: `${(100 * p.value) / top}%` }}
                />
              </span>
              <span className={`num text-right ${now ? "font-medium text-ink" : "text-ink-2"}`}>{p.value.toFixed(2)}%</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 grid grid-cols-[6.5rem_1fr_3.25rem] gap-2 text-label text-ink-3">
        <span />
        <span className="num flex justify-between">
          <span>0%</span>
          <span>{top}%</span>
        </span>
        <span />
      </p>
      <p className="mt-1 text-caption text-ink-3">{m.basis}, from the filed results.</p>
    </figure>
  );
}
