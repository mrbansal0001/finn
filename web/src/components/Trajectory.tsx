import { croreFromCr } from "@/lib/format";
import type { Trajectory as T } from "@/lib/types";

// Trajectory (brief, Pull menu; brief-check plan part 7): five years of revenue and profit, read from the
// annual report's own multi-year table. Every figure is on the cited page as printed (in ₹ crore here); a
// year that failed a check is a gap, never an estimate. The one sentence under the bars is arithmetic on
// those figures, nothing more.

// "TOTAL INCOME" reads as shouting; "PAT" is an abbreviation and stays
const title = (s: string) => (s === s.toUpperCase() && s.includes(" ") ? s.charAt(0) + s.slice(1).toLowerCase() : s);

export function Trajectory({ t }: { t: T }) {
  const ys = t.years;
  const first = ys[0], last = ys[ys.length - 1];
  const span = last.fy - first.fy;
  const pats = ys.filter((y) => y.pat != null);
  const multiple = (a: number, b: number) => (a > 0 && b > 0 ? `${(b / a).toFixed(1)}×` : null);
  const revX = multiple(first.revenue, last.revenue);
  const patX = pats.length >= 2 && pats[0].fy === first.fy && pats[pats.length - 1].fy === last.fy ? multiple(pats[0].pat!, pats[pats.length - 1].pat!) : null;
  const basis = t.basis === "consolidated" ? "consolidated" : t.basis === "standalone" ? "standalone" : null;
  return (
    <figure className="mt-5" aria-label={`Five years of ${title(t.revenue_label).toLowerCase()} and profit`}>
      <figcaption className="text-caption text-ink-3">
        {ys.length} years from the FY{String(t.report_year).slice(2)} annual report&apos;s own table{basis ? `, ${basis}` : ""}
      </figcaption>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <Bars label={title(t.revenue_label)} values={ys.map((y) => ({ fy: y.fy, v: y.revenue }))} />
        {pats.length > 0 ? (
          <Bars label={title(t.profit_label)} values={ys.map((y) => ({ fy: y.fy, v: y.pat }))} />
        ) : (
          <p className="self-center text-caption text-ink-3">The table has no profit row.</p>
        )}
      </div>
      <p className="mt-2 text-small text-ink-2">
        {revX && <>Revenue {revX} in {span} years</>}
        {revX && patX && <>; profit {patX}</>}
        {(revX || patX) && ". "}
        {ys.some((y) => y.pat == null) && pats.length > 0 && (
          <>
            {ys.filter((y) => y.pat == null).map((y) => `FY${String(y.fy).slice(2)}`).join(", ")} profit left out: the figure read failed a check.{" "}
          </>
        )}
        <a href={`${t.url}#page=${t.page}`} target="_blank" rel="noopener noreferrer" className="tap text-accent">
          Annual report, page <span className="num">{t.page}</span>&nbsp;↗︎
        </a>
      </p>
    </figure>
  );
}

function Bars({ label, values }: { label: string; values: { fy: number; v: number | null }[] }) {
  const max = Math.max(...values.map((x) => Math.abs(x.v ?? 0)), 1);
  const last = values[values.length - 1];
  const H = 56;
  return (
    <div className="min-w-0">
      <p className="truncate text-caption text-ink-2" title={label}>
        {label}
      </p>
      <p className="num text-small font-medium text-ink">{croreFromCr(last.v)}</p>
      <div className="mt-1 flex items-end gap-1" style={{ height: H }} role="img"
        aria-label={values.map((x) => `FY${String(x.fy).slice(2)} ${x.v == null ? "not shown (failed a check)" : croreFromCr(x.v)}`).join(", ")}>
        {values.map((x, i) => (
          <span key={x.fy} className="flex flex-1 flex-col items-center justify-end" style={{ height: H }}>
            {x.v == null ? (
              <span className="w-full border-b border-dashed border-ink-3" title="Not shown: the figure failed a check" />
            ) : (
              <span
                className={`w-full rounded-t-sm ${x.v < 0 ? "bg-down" : i === values.length - 1 ? "bg-ink" : "bg-mark"}`}
                style={{ height: Math.max(2, (Math.abs(x.v) / max) * H) }}
              />
            )}
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {values.map((x, i) => (
          <span key={x.fy} className="num flex-1 text-center text-[11px] leading-none text-ink-3">
            {i === 0 ? "FY" : ""}
            {String(x.fy).slice(2)}
          </span>
        ))}
      </div>
    </div>
  );
}
