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
  const chip = (s: Source, i: number) => (
    <li key={i}>
      {s.url ? (
        <a
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center rounded-sm border border-rule px-3 text-meta text-ink-2 hover:border-ink-3 hover:text-ink"
        >
          {s.label}
          {s.page ? <span className="num ml-1 text-ink-3">p.{s.page}</span> : null}
          <span aria-hidden className="ml-1 text-ink-3">↗</span>
        </a>
      ) : (
        <span className="inline-flex min-h-[40px] items-center rounded-sm border border-rule px-3 text-meta text-ink-3">
          {s.label} · no link
        </span>
      )}
    </li>
  );
  return (
    <div className="mt-3">
      <ul className="flex flex-wrap gap-1.5" aria-label="Sources">
        {unique.slice(0, 4).map(chip)}
      </ul>
      {unique.length > 4 && (
        // every source stays reachable, not just counted (audit F03)
        <details className="mt-1.5">
          <summary className="inline-flex min-h-[36px] items-center text-meta text-accent">All {unique.length} sources</summary>
          <ul className="mt-1 flex flex-wrap gap-1.5">{unique.slice(4).map((s, i) => chip(s, i + 4))}</ul>
        </details>
      )}
    </div>
  );
}
