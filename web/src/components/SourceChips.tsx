import type { Source } from "@/lib/types";

/** Every claim one tap from its source (design principle 4). */
export function SourceChips({ sources }: { sources: Source[] }) {
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    const k = `${s.label}|${s.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Sources">
      {unique.slice(0, 4).map((s, i) => (
        <li key={i}>
          {s.url ? (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[28px] items-center rounded-sm border border-rule px-2 text-[0.75rem] text-ink-2 hover:border-ink-3 hover:text-ink"
            >
              {s.label}
              {s.page ? <span className="num ml-1 text-ink-3">p.{s.page}</span> : null}
              <span aria-hidden className="ml-1 text-ink-3">↗</span>
            </a>
          ) : (
            <span className="inline-flex min-h-[28px] items-center rounded-sm border border-rule px-2 text-[0.75rem] text-ink-3">
              {s.label}
            </span>
          )}
        </li>
      ))}
      {unique.length > 4 && <li className="self-center text-[0.75rem] text-ink-3">+{unique.length - 4}</li>}
    </ul>
  );
}
