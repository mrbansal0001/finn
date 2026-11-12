"use client";

import Link from "next/link";
import { useRef, useState } from "react";

export type Session = { d: string; c: number; pc: number; v: number; avg: number | null; n: number; gap?: boolean };
export type Marker = { d: string; time: string; afterClose: boolean; title: string; href: string; external?: boolean };

const inr2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const MINUS = "−";
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v).toFixed(1)}%`;
const day = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${iso}T12:00:00+05:30`).toLocaleDateString("en-GB", { ...opts, timeZone: "Asia/Kolkata" });
const vol = (v: number) => (v >= 1e7 ? `${(v / 1e7).toFixed(2)} cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} lakh` : inr0.format(v));

/**
 * How unusual was this move against recent trading? (visual review §5)
 * Two panels on one session axis: closing price (a thin line) and volume (bars from zero) with each day's
 * own baseline, the average of the previous 20 sessions excluding that day, which is what the alert uses.
 * Closes are as traded; a session whose exchange previous close differs from the prior close breaks the line
 * (a session not loaded, e.g. the Sunday Muhurat session, or a corporate action). Filing markers show timing,
 * never cause. Tap, drag or use the arrow keys; every value is also in the table.
 */
export function PriceVolumeChart({ rows, alertDay, markers, symbol }: { rows: Session[]; alertDay: string; markers: Marker[]; symbol: string }) {
  const alertIdx = Math.max(0, rows.findIndex((r) => r.d === alertDay));
  const [sel, setSel] = useState(alertIdx);
  const svg = useRef<SVGSVGElement>(null);
  const W = 340, PL = 4, PR = 46, PT = 14, PH = 130, GAP = 18, VH = 96, XH = 18;
  const H = PT + PH + GAP + VH + XH;
  const n = rows.length;
  const x = (i: number) => PL + ((i + 0.5) * (W - PL - PR)) / n;
  const bw = Math.max(2, ((W - PL - PR) / n) * 0.62);
  const closes = rows.map((r) => r.c);
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const pad = (hi - lo) * 0.12 || hi * 0.01;
  const yP = (v: number) => PT + PH - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * PH;
  const vmax = Math.max(...rows.map((r) => Math.max(r.v, r.avg ?? 0))) * 1.08;
  const vTop = PT + PH + GAP;
  const yV = (v: number) => vTop + VH - (v / vmax) * VH;

  // the price line, broken where the series has a gap
  const segs: string[] = [];
  rows.forEach((r, i) => {
    const pt = `${x(i).toFixed(1)},${yP(r.c).toFixed(1)}`;
    if (i === 0 || r.gap) segs.push(pt);
    else segs[segs.length - 1] += ` ${pt}`;
  });

  const r = rows[sel];
  const chg = (r.c / r.pc - 1) * 100;
  const mult = r.avg ? r.v / r.avg : null;
  const here = markers.filter((m) => m.d === r.d);
  const pick = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const fx = ((clientX - box.left) / box.width) * W;
    setSel(Math.max(0, Math.min(n - 1, Math.floor(((fx - PL) / (W - PL - PR)) * n))));
  };
  const ticks = [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <figure className="mt-4">
      {/* fixed readout: the selected session, as the alert computes it */}
      <div className="flex items-end justify-between gap-3" aria-live="polite">
        <div>
          <p className="num text-caption text-ink-3">
            {day(r.d)}
            {sel === alertIdx ? <span className="ml-2 tag">The alert</span> : null}
          </p>
          <p className="num text-body font-medium text-ink">₹{inr2.format(r.c)}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 text-right">
          <dt className="text-caption text-ink-3">Change</dt>
          <dt className="text-caption text-ink-3">Volume</dt>
          <dd className="num text-small font-medium text-ink">{signed(chg)}</dd>
          <dd className="num text-small font-medium text-ink">{mult ? `${mult.toFixed(1)}× avg` : "no baseline"}</dd>
        </dl>
      </div>

      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full touch-pan-y select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        role="slider"
        tabIndex={0}
        aria-label={`${symbol} closing price and volume, last ${n} sessions. Use the arrow keys to move between sessions.`}
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={sel + 1}
        aria-valuetext={`${day(r.d)}: close ₹${inr2.format(r.c)}, ${signed(chg)}, volume ${mult ? `${mult.toFixed(1)} times its average` : "with no baseline"}`}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pick(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && pick(e.clientX)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
          else if (e.key === "ArrowRight") setSel((s) => Math.min(n - 1, s + 1));
          else if (e.key === "Home") setSel(0);
          else if (e.key === "End") setSel(n - 1);
          else return;
          e.preventDefault();
        }}
      >
        {/* panel labels and scales, outside the touch area's data */}
        <text x={PL} y={PT - 4} className="fill-ink-3" fontSize="9">Close, ₹ (as traded)</text>
        <text x={W - PR + 4} y={yP(hi) + 3} className="fill-ink-3" fontSize="9">{inr0.format(hi)}</text>
        <text x={W - PR + 4} y={yP(lo) + 3} className="fill-ink-3" fontSize="9">{inr0.format(lo)}</text>
        <line x1={PL} x2={W - PR} y1={PT + PH} y2={PT + PH} className="stroke-rule" strokeWidth="1" />
        {segs.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" className="stroke-ink-2" strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        {rows.map((row, i) =>
          row.gap ? <line key={`g${i}`} x1={x(i) - bw} x2={x(i) - bw} y1={PT} y2={PT + PH} className="stroke-rule" strokeDasharray="2 2" /> : null,
        )}
        {/* filing markers on the session they were filed; hollow when filed after the close */}
        {rows.map((row, i) => {
          const ms = markers.filter((m) => m.d === row.d);
          if (!ms.length) return null;
          const after = ms.every((m) => m.afterClose);
          return <path key={`m${i}`} d={`M${x(i) - 4},${PT + 1} l4,6 l4,-6 z`} className={after ? "fill-paper stroke-accent" : "fill-accent stroke-accent"} strokeWidth="1" />;
        })}

        <text x={PL} y={vTop - 4} className="fill-ink-3" fontSize="9">Volume, shares; dashed: 20-session average</text>
        <text x={W - PR + 4} y={vTop + 8} className="fill-ink-3" fontSize="9">{vol(vmax / 1.08)}</text>
        <text x={W - PR + 4} y={vTop + VH} className="fill-ink-3" fontSize="9">0</text>
        <line x1={PL} x2={W - PR} y1={vTop + VH} y2={vTop + VH} className="stroke-rule" strokeWidth="1" />
        {rows.map((row, i) => (
          <rect key={`v${i}`} x={x(i) - bw / 2} y={yV(row.v)} width={bw} height={vTop + VH - yV(row.v)} className={i === sel ? "fill-accent" : i === alertIdx ? "fill-ink-2" : "fill-ink-3/45"} />
        ))}
        {rows.map((row, i) =>
          row.avg ? <line key={`a${i}`} x1={x(i) - bw / 2 - 1} x2={x(i) + bw / 2 + 1} y1={yV(row.avg)} y2={yV(row.avg)} className="stroke-ink" strokeWidth="1" strokeDasharray="2 1.5" /> : null,
        )}

        {/* the selection guide through both panels */}
        <line x1={x(sel)} x2={x(sel)} y1={PT} y2={vTop + VH} className="stroke-accent" strokeWidth="1" />
        <circle cx={x(sel)} cy={yP(r.c)} r="3.5" className="fill-accent stroke-paper" strokeWidth="1.5" />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 4} textAnchor={t === 0 ? "start" : t === n - 1 ? "end" : "middle"} className="fill-ink-3" fontSize="9">
            {day(rows[t].d, { day: "numeric", month: "short" })}
          </text>
        ))}
      </svg>

      {/* one caption line at most (layout plan §9.5); the definitions sit with the table below */}
      <figcaption className="mt-1 text-caption text-ink-3">
        Dashed: the alert&apos;s 20-session average. ▼ a filing (hollow: after the close); timing, not cause.
      </figcaption>

      {here.length > 0 && (
        <ul className="mt-3 space-y-2 rounded-lg bg-tint px-4 py-3">
          {here.map((m) => (
            <li key={m.href + m.time} className="text-small">
              <span className="num text-caption text-ink-3">
                Filed {m.time}
                {m.afterClose ? ", after the close" : ", during market hours"}
              </span>
              <br />
              {m.external ? (
                <a href={m.href} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">
                  {m.title} <span className="text-accent">↗</span>
                </a>
              ) : (
                <Link href={m.href} className="text-ink hover:underline">
                  {m.title} <span className="text-accent">›</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      {sel !== alertIdx && (
        <button onClick={() => setSel(alertIdx)} className="mt-2 min-h-[44px] text-small font-medium text-accent">
          ‹ Back to the alert session
        </button>
      )}

      <details className="mt-1">
        <summary className="inline-flex min-h-[44px] items-center text-small text-ink-2">Every session as a table, and how it&apos;s measured</summary>
        <div className="mb-2 space-y-1 text-caption text-ink-3">
          <p>
            {n} trading sessions; weekends and holidays aren&apos;t on the axis. Change is the close against the exchange&apos;s previous close. The
            average is the previous {r.n === 20 ? "20 sessions" : `${r.n} sessions (fewer were available)`}, excluding the day itself, as the alert
            uses. Closes are as traded, not adjusted for splits or bonuses.
          </p>
          {rows.some((x) => x.gap) && (
            <p>A dashed break: the exchange&apos;s previous close differs from the prior close shown (a session not loaded, or a corporate action).</p>
          )}
        </div>
        <table className="w-full text-caption">
          <thead>
            <tr className="text-ink-3">
              <th className="py-1 text-left font-medium">Session</th>
              <th className="text-right font-medium">Close</th>
              <th className="text-right font-medium">Change</th>
              <th className="text-right font-medium">Volume</th>
              <th className="text-right font-medium">× avg</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.d} className={`border-t border-rule ${row.d === alertDay ? "font-medium text-ink" : "text-ink-2"}`}>
                <td className="num py-1">{day(row.d, { day: "numeric", month: "short" })}</td>
                <td className="num text-right">{inr2.format(row.c)}</td>
                <td className="num text-right">{signed((row.c / row.pc - 1) * 100)}</td>
                <td className="num text-right">{vol(row.v)}</td>
                <td className="num text-right">{row.avg ? (row.v / row.avg).toFixed(1) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
