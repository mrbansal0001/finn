type S = { d: string; c: number; pc: number; v: number; avg: number | null; gap?: boolean };

/**
 * A word-sized picture of one alert (Tufte's sparkline: data-intense, design-simple, sized to sit in a line
 * of text). The closing price over the sessions up to and including the alert day, and under it each day's
 * volume as a thin bar, the alert day in the accent colour. It answers "did this come out of nowhere, or was
 * it already running, and did volume really stand out?" without opening the card.
 *
 * Same data and rules as the move chart (worker prices.series): closes as traded, the line broken where the
 * exchange's previous close differs; nothing after the alert day is drawn. Too little history: nothing drawn.
 */
export function MoveSpark({
  rows, day, width = 72, height = 30, label, marks = [],
}: { rows: S[] | undefined; day: string; width?: number; height?: number; label?: string; marks?: string[] }) {
  const upto = (rows ?? []).filter((r) => r.d <= day).slice(-20);
  if (upto.length < 8 || upto[upto.length - 1].d !== day) return <span aria-hidden className="block" style={{ width, height }} />;
  const n = upto.length;
  const top = marks.length ? 6 : 0; // room for filing marks above the line
  const lineH = height * 0.62, barTop = height * 0.7, barH = height - barTop;
  const closes = upto.map((r) => r.c);
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const span = hi - lo || hi * 0.01;
  const x = (i: number) => 1.5 + (i * (width - 3)) / (n - 1);
  const y = (v: number) => top + 2 + (1 - (v - lo) / span) * (lineH - top - 2);
  const vmax = Math.max(...upto.map((r) => r.v));
  const bw = Math.max(1.2, ((width - 3) / n) * 0.6);
  const segs: string[] = [];
  upto.forEach((r, i) => {
    const pt = `${x(i).toFixed(1)},${y(r.c).toFixed(1)}`;
    if (i === 0 || r.gap) segs.push(pt);
    else segs[segs.length - 1] += ` ${pt}`;
  });
  const last = upto[n - 1];
  const up = last.c >= last.pc;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible" role="img" aria-label={label ?? `Price over ${n} sessions and volume each day; the alert day is highlighted`}>
      {/* the key, where the chart is: a tooltip on hover, read out by screen readers (layout plan §9.5) */}
      <title>{label ?? "The last 20 closes as a line; each day's volume as a bar, the alert day in blue"}</title>
      {/* a filing that day: a small mark above the line (timing, not cause) */}
      {upto.map((r, i) => (marks.includes(r.d) ? <path key={`m${r.d}`} d={`M${x(i) - 2.5},0.5 l2.5,4 l2.5,-4 z`} className="fill-accent" /> : null))}
      {segs.map((p, i) => (
        <polyline key={i} points={p} fill="none" className="stroke-ink-3" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* the alert session: the last step of the line, in the direction's colour, ending in a dot */}
      {!last.gap && (
        <line x1={x(n - 2)} y1={y(upto[n - 2].c)} x2={x(n - 1)} y2={y(last.c)} className={up ? "stroke-up" : "stroke-down"} strokeWidth="1.75" strokeLinecap="round" />
      )}
      <circle cx={x(n - 1)} cy={y(last.c)} r="2.4" className={up ? "fill-up" : "fill-down"} />
      {upto.map((r, i) => (
        <rect key={r.d} x={x(i) - bw / 2} y={barTop + barH - (r.v / vmax) * barH} width={bw} height={Math.max(0.6, (r.v / vmax) * barH)} className={i === n - 1 ? "fill-accent" : "fill-mark"} />
      ))}
    </svg>
  );
}
