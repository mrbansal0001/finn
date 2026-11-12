import type { ResultsFacts } from "@/lib/types";
import { bp, crore, croreFromCr, dirClass, fyQuarter, pct } from "@/lib/format";

/**
 * The results table (plan §8.6): label | value | YoY | QoQ, tabular figures right-aligned, margins in bp,
 * the sign carries direction (colour only helps; no arrows). Banks: NII, operating profit, provisions, PAT,
 * then gross NPA. When only the XBRL exists (no comparatives), YoY/QoQ show as pending, never guessed.
 */
export function ResultsTable({ r }: { r: ResultsFacts }) {
  const c = r.comparatives;
  const v = r.values as Record<string, number | null>;
  const isBank = c?.is_bank ?? false;
  // a lender pays interest as its main cost, so EBITDA isn't meaningful (Bajaj Finance showed "71%")
  const isLender = c?.is_lender ?? false;

  const rows: { label: string; value: string; yoy?: number | null; qoq?: number | null; unit?: "pct" | "bp" }[] = isBank
    ? [
        { label: "NII", value: croreFromCr(c?.current?.nii), yoy: c?.yoy?.nii, qoq: c?.qoq?.nii },
        { label: "Op. profit", value: croreFromCr(c?.current?.ppop), yoy: c?.yoy?.ppop, qoq: c?.qoq?.ppop },
        { label: "Provisions", value: croreFromCr(c?.current?.provisions), yoy: c?.yoy?.provisions, qoq: c?.qoq?.provisions },
        { label: "PAT", value: croreFromCr(c?.current?.pat), yoy: c?.yoy?.pat, qoq: c?.qoq?.pat },
      ]
    : [
        { label: "Revenue", value: c ? croreFromCr(c.current.revenue) : crore(v.revenue), yoy: c?.yoy?.revenue, qoq: c?.qoq?.revenue },
        ...(isLender
          ? []
          : [{
              label: "EBITDA",
              value: c ? croreFromCr(c.current.ebitda) : crore(v._ebitda as number | null),
              yoy: c?.yoy?.ebitda,
              qoq: c?.qoq?.ebitda,
            }]),
        { label: "PBT", value: c ? croreFromCr(c.current.pbt) : crore(v.pbt), yoy: c?.yoy?.pbt, qoq: c?.qoq?.pbt },
        { label: "PAT", value: c ? croreFromCr(c.current.pat) : crore(v.pat), yoy: c?.yoy?.pat, qoq: c?.qoq?.pat },
      ];

  const margin = c?.current?.ebitda_margin_pct;
  // comparatives are in ₹ crore; raw XBRL values are in rupees
  const exceptionalLabel = c ? (c.current?.exceptional ? croreFromCr(c.current.exceptional) : null)
    : (v.exceptional ? crore(v.exceptional as number) : null);

  return (
    <figure className="mt-3">
      <table className="w-full text-small">
        <caption className="sr-only">Results {fyQuarter(r.period_end)}</caption>
        <thead>
          <tr className="kicker text-ink-3">
            <th className="pb-2 text-left font-semibold">{fyQuarter(r.period_end)}</th>
            <th className="pb-2 text-right font-semibold" />
            <th className="w-[4.75rem] pb-2 text-right font-semibold">YoY</th>
            <th className="w-[4.75rem] pb-2 text-right font-semibold">QoQ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="h-10 border-t border-rule">
              <td className="text-ink-2">{row.label}</td>
              <td className="num text-right font-medium text-ink">{row.value}</td>
              <Delta v={row.yoy} pending={!c} />
              <Delta v={row.qoq} pending={!c} />
            </tr>
          ))}
          {margin != null && (
            <tr className="h-10 border-t border-rule">
              <td className="text-ink-2">EBITDA margin</td>
              <td className="num text-right font-medium">{margin.toFixed(1)}%</td>
              <td className={`num text-right font-medium ${dirClass(c?.yoy?.ebitda_margin_bp)}`}>{bp(c?.yoy?.ebitda_margin_bp)}</td>
              <td className={`num text-right font-medium ${dirClass(c?.qoq?.ebitda_margin_bp)}`}>{bp(c?.qoq?.ebitda_margin_bp)}</td>
            </tr>
          )}
          {isBank && c?.current?.gnpa_pct != null && (
            <tr className="h-10 border-t border-rule">
              <td className="text-ink-2">Gross NPA</td>
              <td className="num text-right font-medium">{c.current.gnpa_pct.toFixed(2)}%</td>
              <td className="text-right text-ink-3" colSpan={2}>
                {c.current.nnpa_pct != null ? <span className="num">net {c.current.nnpa_pct.toFixed(2)}%</span> : null}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <figcaption className="mt-2 text-caption text-ink-3">
        <p>
          {r.nature}.
          {r.reporting === "Half Yearly" ? " Half-yearly reporter, so no QoQ." : ""}
          {exceptionalLabel ? ` Includes a ${exceptionalLabel} exceptional item.` : ""}
          {c?.net_of_excise ? " Revenue is net of excise." : ""}
          {r.source_url && (
            <>
              {" "}
              <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="tap whitespace-nowrap text-accent">
                {r.source === "xbrl" ? "Exchange XBRL data (XML)" : `Results PDF${pageOf(r.source_url)}`} ↗
              </a>
            </>
          )}
        </p>
        {/* one line says it was checked; the list of what ran is one tap away (audit F07) */}
        <details className="mt-1">
          <summary className="inline-flex min-h-[44px] items-center gap-1.5 text-ink-2">
            <span aria-hidden className="text-up">✓</span>
            {r.check === "xbrl_exact" && !c
              ? "Exact from the exchange XBRL"
              : `${c?.checks?.filter((x) => !x.startsWith("XBRL")).length ?? 0} checks passed${r.check === "xbrl_match" ? ", and it matches the exchange XBRL" : ""}`}
            <span aria-hidden className="text-ink-3">›</span>
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {(c?.checks ?? []).map((x) => (
              <li key={x}>{x}</li>
            ))}
            {!(isBank || isLender) && <li>EBITDA = PBT before exceptional items + finance costs + depreciation − other income</li>}
            {r.check === "xbrl_exact" && !c && <li>QoQ and YoY appear once the comparison table is read</li>}
          </ul>
        </details>
      </figcaption>
    </figure>
  );
}

function Delta({ v, pending }: { v?: number | null; pending: boolean }) {
  if (pending) return <td className="num text-right text-ink-3">–</td>;
  return <td className={`num text-right font-medium ${dirClass(v)}`}>{pct(v)}</td>;
}

function pageOf(url: string): string {
  const m = url.match(/#page=(\d+)/);
  return m ? `, p.${m[1]}` : "";
}
