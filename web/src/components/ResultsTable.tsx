import type { ResultsFacts } from "@/lib/types";
import { arrow, bp, crore, croreFromCr, dirClass, fyQuarter, pct } from "@/lib/format";

/**
 * The 4-row results micro-table (research 03 §4.1): tabular figures, margins in bp,
 * sign + arrow + colour (never colour alone). Banks get NII / PPOP / provisions / PAT.
 * When only the XBRL is available (current quarter, no comparatives), QoQ/YoY show
 * as pending instead of being guessed.
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
      <table className="w-full text-[0.875rem]">
        <caption className="sr-only">Results {fyQuarter(r.period_end)}</caption>
        <thead>
          <tr className="text-[0.6875rem] uppercase tracking-wider text-ink-3">
            <th className="pb-1 text-left font-medium">{fyQuarter(r.period_end)}</th>
            <th className="pb-1 text-right font-medium" />
            <th className="pb-1 text-right font-medium">YoY</th>
            <th className="pb-1 text-right font-medium">QoQ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-rule">
              <td className="py-1 text-ink-2">{row.label}</td>
              <td className="num py-1 text-right text-ink">{row.value}</td>
              <Delta v={row.yoy} pending={!c} />
              <Delta v={row.qoq} pending={!c} />
            </tr>
          ))}
          {margin != null && (
            <tr className="border-t border-rule">
              <td className="py-1 text-ink-2">EBITDA m.</td>
              <td className="num py-1 text-right">{margin.toFixed(1)}%</td>
              <td className={`num py-1 text-right ${dirClass(c?.yoy?.ebitda_margin_bp)}`}>{bp(c?.yoy?.ebitda_margin_bp)}</td>
              <td className={`num py-1 text-right ${dirClass(c?.qoq?.ebitda_margin_bp)}`}>{bp(c?.qoq?.ebitda_margin_bp)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <figcaption className="mt-1.5 text-[0.75rem] leading-snug text-ink-3">
        {r.nature}
        {r.reporting === "Half Yearly" ? " · half-yearly reporter, no QoQ" : ""}
        {exceptionalLabel ? ` · includes exceptional item ${exceptionalLabel}` : ""}
        {" · "}
        {r.check === "xbrl_exact" && !c
          ? "exact from XBRL; QoQ/YoY appear once the comparison table is read"
          : r.check === "xbrl_match"
            ? "table checked against XBRL"
            : r.check === "arithmetic_ok"
              ? "columns and totals reconciled (half year = two quarters)"
              : r.check}
        {c?.net_of_excise ? " · revenue net of excise duty" : ""}
        {isBank || isLender ? "" : " · EBITDA = PBT before exceptional + finance costs + D&A − other income"}
      </figcaption>
    </figure>
  );
}

function Delta({ v, pending }: { v?: number | null; pending: boolean }) {
  if (pending) return <td className="num py-1 text-right text-ink-3">·</td>;
  return (
    <td className={`num py-1 text-right ${dirClass(v)}`}>
      {pct(v)}
      <span className="ml-0.5 text-[0.625rem]" aria-hidden>
        {arrow(v)}
      </span>
    </td>
  );
}
