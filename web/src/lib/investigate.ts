import type { Card, Ledger, PromiseRow, ResultsFacts, Snapshot, Source } from "./types";
import { croreFromCr, fyQuarter, pct, price, times, KIND_LABEL } from "./format";
import type { LensKey } from "./lenses";

/**
 * Investigate (creative review, signature concept): one surface that carries an event, the question it
 * raises, the company's own words on it, and the person who could help, so the investor doesn't rebuild
 * the context on every page.
 *
 * Every question is written from figures and statuses already on screen, by fixed rules, never by a model.
 * It is framed as a question: an observed difference is not an explanation (review §2, "What remains unclear").
 */
export type Obs = { label: string; value: string; dir?: number | null };

export type Passage = {
  label: string;          // "Promise, last said Nov 2026"
  title: string;          // the promise or filing in a line
  quote?: string;         // the company's own words
  cite?: { href: string; text: string };
  open?: string;          // a deeper route inside FINN
};

export type MarginPlot = { points: { label: string; value: number }[]; change: number; basis: string };

export type Investigation = {
  kind: string;
  kicker: string;
  symbol: string;
  company: string;
  title: string;
  eventHref?: string;
  question: string;
  observed: Obs[];
  observedNote?: string;
  margin?: MarginPlot;
  unclear: string;
  passagesTitle: string;
  passages: Passage[];
  passagesEmpty: string;
  promise?: PromiseRow;
  lens: LensKey[];        // lenses to try first, in order
  sources: Source[];
  revisit: "results" | "call" | "filing";
};

const short = (s: string) => s.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
const abs = (v: number) => Math.abs(v).toFixed(1);

// ---------------------------------------------------------------- results

/** The question a results table raises, from its own figures. Order: the most specific signal first. */
export function resultsQuestion(r: ResultsFacts): { q: string; unclear: string } | null {
  const c = r.comparatives;
  if (!c) return null;
  const y = c.yoy, cur = c.current;
  const unclear = "The table shows what changed, not why. The notes to the results and the next earnings call are where the company explains it.";
  if (c.is_bank) {
    const prov = y.provisions, pat = y.pat, nii = y.nii;
    if (prov != null && prov >= 20) return { q: `Provisions rose ${abs(prov)}% from a year ago. Is this one book of loans, or a wider rise in stress?`, unclear };
    if (nii != null && pat != null && nii < 5 && pat > 10) return { q: `Profit rose ${abs(pat)}% while net interest income grew ${pct(nii)}. What carried the profit: lower provisions, fees or treasury gains?`, unclear };
    if (nii != null) return { q: `Net interest income ${nii >= 0 ? "grew" : "fell"} ${abs(nii)}% from a year ago. Is the margin on loans holding as rates move?`, unclear };
    return null;
  }
  const rev = y.revenue, pat = y.pat, mbp = y.ebitda_margin_bp;
  const exc = cur.exceptional, pbt = cur.pbt, ex = y.pbt_ex_exceptional;
  if (exc && pbt && Math.abs(exc) / Math.abs(pbt) >= 0.1 && pat != null && ex != null) {
    return {
      q: `Profit after tax ${pat >= 0 ? "rose" : "fell"} ${abs(pat)}%, but it includes a ${croreFromCr(exc)} exceptional item. Without it, profit before tax ${ex >= 0 ? "rose" : "fell"} ${abs(ex)}%. Which is the real run-rate, and will the item recur?`,
      unclear: "The exceptional item is in the filed table; what it was, and whether it repeats, is in the notes to the results.",
    };
  }
  if (rev != null && mbp != null && !c.is_lender) {
    if (rev > 0 && mbp <= -50) return { q: `Revenue grew ${abs(rev)}% but the EBITDA margin fell ${Math.abs(Math.round(mbp))}bp. Which costs grew faster than sales, and is that temporary?`, unclear };
    if (mbp >= 50) return { q: `The EBITDA margin widened ${Math.round(mbp)}bp from a year ago. Is it mix, pricing or cheaper inputs, and can it last?`, unclear };
  }
  if (rev != null && pat != null) {
    if (rev < 0 && pat > 0) return { q: `Revenue fell ${abs(rev)}% while profit rose ${abs(pat)}%. Lower costs, other income or a one-off?`, unclear };
    if (rev > 0 && pat < 0) return { q: `Revenue grew ${abs(rev)}% but profit fell ${abs(pat)}%. Where did the profit go?`, unclear };
    if (rev < 0 && pat < 0) return { q: `Revenue fell ${abs(rev)}% and profit ${abs(pat)}%. Is this the industry's cycle or something specific to the company?`, unclear };
    return { q: `Revenue grew ${abs(rev)}% and profit ${abs(pat)}%. What does management expect from here, and what did it promise before?`, unclear };
  }
  return null;
}

/** Last year's quarter, last quarter and this one, from the filed table (EBITDA ÷ revenue). */
export function marginPlot(r: ResultsFacts): MarginPlot | undefined {
  const c = r.comparatives as (ResultsFacts["comparatives"] & { prev_y?: Record<string, number | null>; prev_q?: Record<string, number | null> }) | null;
  if (!c || c.is_bank || c.is_lender) return undefined;
  const m = (x?: Record<string, number | null>) => (x?.ebitda != null && x?.revenue ? (100 * x.ebitda) / x.revenue : null);
  const now = c.current.ebitda_margin_pct ?? m(c.current);
  const py = m(c.prev_y), pq = m(c.prev_q);
  if (now == null || py == null) return undefined;
  const q = fyQuarter(r.period_end);
  const points = [{ label: "A year ago", value: py }, ...(pq != null && r.reporting !== "Half Yearly" ? [{ label: "Last quarter", value: pq }] : []), { label: q, value: now }];
  return { points, change: c.yoy.ebitda_margin_bp ?? (now - py) * 100, basis: `${r.nature}, EBITDA ÷ revenue` };
}

function resultsObs(r: ResultsFacts): Obs[] {
  const c = r.comparatives;
  if (!c) return [];
  const y = c.yoy, cur = c.current;
  if (c.is_bank)
    return [
      { label: "Net interest income", value: croreFromCr(cur.nii), dir: y.nii },
      { label: "Provisions", value: croreFromCr(cur.provisions), dir: y.provisions },
      { label: "Profit after tax", value: croreFromCr(cur.pat), dir: y.pat },
    ];
  return [
    { label: "Revenue", value: croreFromCr(cur.revenue), dir: y.revenue },
    ...(c.is_lender ? [] : [{ label: "EBITDA", value: croreFromCr(cur.ebitda), dir: y.ebitda }]),
    { label: "Profit after tax", value: croreFromCr(cur.pat), dir: y.pat },
    ...(cur.exceptional ? [{ label: "Exceptional item", value: croreFromCr(cur.exceptional) }] : []),
  ];
}

// ---------------------------------------------------------------- promises

const METRIC_LENS: [RegExp, LensKey[]][] = [
  [/order|production|commission|capacity|launch|plant|facility|ramp|delivery|construction|project/i, ["execution", "demand"]],
  [/revenue|growth|volume|market share|sales|demand|inflow|customer|store/i, ["demand", "execution"]],
  [/margin|ebitda|capex|debt|cost|tax|dividend|roce|roe|cash|leverage|expense|credit|provision|npa/i, ["money", "execution"]],
  [/approval|regulat|licen|litigation|policy|rating/i, ["rules", "money"]],
];

export function promiseLens(metric: string): LensKey[] {
  return METRIC_LENS.find(([re]) => re.test(metric))?.[1] ?? ["execution", "demand", "money"];
}

/** "A → B" from the latest revision note; the first and latest stated targets otherwise. */
export function promiseChange(row: PromiseRow, calls: Ledger["calls"]): { from?: string; to?: string; fromCall?: string; toCall?: string } {
  const cells = calls.map((c) => ({ call: c.label, cell: row.calls[c.label] })).filter((x) => x.cell?.status);
  const revs = cells.filter((x) => x.cell.status === "revised" && x.cell.note);
  if (!revs.length) return {};
  const first = cells.find((x) => /^(new|quantified):/i.test(x.cell.note ?? ""));
  const last = revs[revs.length - 1];
  // "A → B" (built ledgers) or just the new target (hand-checked notes: "by June-end")
  const b = last.cell.note!.split("→").pop()!.replace(/↻/g, "").trim();
  const a = first ? first.cell.note!.replace(/^(new|quantified):\s*/i, "").trim() : revs[0].cell.note!.includes("→") ? revs[0].cell.note!.split("→")[0].trim() : "";
  if (!a || a === b) return {};
  return { from: a, to: b, fromCall: first?.call ?? revs[0].call, toCall: last.call };
}

export function promiseQuestion(row: PromiseRow, calls: Ledger["calls"], title: string): string {
  const what = row.metric.charAt(0).toUpperCase() + row.metric.slice(1);
  if (row.latest === "revised") {
    const ch = promiseChange(row, calls);
    if (ch.from && ch.to) return `${what}: stated as ${ch.from} in ${ch.fromCall}, now ${ch.to}. What changed, and is the new target more believable than the old one?`;
    return `${what} has been revised. What changed, and is the new target more believable than the old one?`;
  }
  if (row.latest === "silent") return `${what} was stated on earlier calls, then not mentioned on the latest one. Was it dropped, delayed or quietly done?`;
  if (row.latest === "closed") return `The period for “${title}” has ended and no call has said whether it happened. Did it?`;
  if (row.latest === "delivered" || row.latest === "partly" || row.latest === "missed")
    return `${title}: by management's own later figure, ${row.latest === "partly" ? "partly delivered" : row.latest}. What does that say about the target they've set next?`;
  if (row.tracking) return `${title}: ${row.tracking.metric} was ${row.tracking.value}% in ${row.tracking.label}. Is the full year on course?`;
  return `${title}: what has to go right for this to happen, and how would you know early if it won't?`;
}

const ATTENTION = new Set(["revised", "silent", "missed", "partly", "closed", "delivered"]);

/** Promises worth reading next to an event: those on the same metric first, then the ones that changed. */
function relatedPromises(ledger: Ledger | null, symbol: string, metric: RegExp | null, n: number): Passage[] {
  if (!ledger) return [];
  const score = (r: PromiseRow) =>
    (metric && metric.test(`${r.metric} ${r.title}`) ? 100 : 0) + (r.tracking ? 50 : 0) + (ATTENTION.has(r.latest) ? 20 : 0) + (r.mentions ?? 1) * 3
    - (/: (no figure|direction only)$/.test(r.title) ? 15 : 0) - (r.latest === "closed" ? 120 : 0);   // an ended period is history, not a lead
  return [...ledger.rows]
    .filter((r) => (metric ? metric.test(`${r.metric} ${r.title}`) || ATTENTION.has(r.latest) : ATTENTION.has(r.latest)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n)
    .map((r) => promisePassage(r, symbol));
}

export function promisePassage(r: PromiseRow, symbol: string): Passage {
  const q = r.latest_quote ?? r.first_quote;
  return {
    label: `Promise, ${STATUS_WORD[r.latest] ?? r.latest}${q ? `, last said ${q.call}` : ""}`,
    title: promiseTitle(r.title),
    quote: q?.text,
    cite: q?.url ? { href: `${q.url}#page=${q.page}`, text: `transcript p.${q.page}` } : undefined,
    open: `/investigate?c=${encodeURIComponent(symbol)}&p=${encodeURIComponent(r.id)}`,
  };
}

const STATUS_WORD: Record<string, string> = {
  delivered: "delivered", partly: "partly delivered", missed: "missed", revised: "revised", silent: "went silent",
  closed: "period ended", early: "open", conflict: "conflicting",
};

export function promiseTitle(t: string): string {
  return t.replace(/^(.*?) · ([^:]+): /, "$1 ($2): ").replace(/ · /g, ", ");
}

// ---------------------------------------------------------------- builders

export function fromCard(card: Card, snap: Snapshot, ledger: Ledger | null): Investigation {
  const co = short(card.company);
  const base = {
    kind: card.kind,
    kicker: KIND_LABEL[card.kind] ?? "Filing",
    symbol: card.symbol,
    company: card.company,
    title: card.headline ?? `${co}: ${card.nse_subject}`,
    eventHref: `/card/${card.id}`,
    sources: card.sources,
  };
  const r = card.facts.results;
  if (card.kind === "results" && r) {
    const rq = resultsQuestion(r);
    return {
      ...base,
      question: rq?.q ?? `What does management say drove ${fyQuarter(r.period_end)}, and how does it compare with what they promised?`,
      observed: resultsObs(r),
      observedNote: `${fyQuarter(r.period_end)}, ${r.nature.toLowerCase()}, change from the same quarter a year ago.`,
      margin: marginPlot(r),
      unclear: rq?.unclear ?? "The table shows what changed, not why.",
      passagesTitle: "What management said it would deliver",
      passages: relatedPromises(ledger, card.symbol, /revenue|margin|ebitda|profit|pat|growth|volume|sales/i, 3),
      passagesEmpty: ledger ? "No promise on revenue, margins or profit in the last four calls." : "No promises ledger for this company yet.",
      lens: r.comparatives?.is_bank ? ["money", "rules"] : ["money", "demand", "execution"],
      revisit: "call",
    };
  }
  if (card.kind === "move") {
    const f = card.facts as { close?: number; change_pct?: number; volume_multiple?: number; explained_by?: string | null; other_sessions?: number };
    const up = (f.change_pct ?? 0) >= 0;
    const prior = [...snap.editions["30d"].leads, ...snap.editions["30d"].more]
      .filter((c) => c.symbol === card.symbol && c.kind !== "move" && c.at <= card.at)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 2)
      .map<Passage>((c) => ({ label: `Filing, ${KIND_LABEL[c.kind] ?? "other"}`, title: c.headline ?? c.nse_subject, open: `/card/${c.id}` }));
    return {
      ...base,
      kicker: "Price move",
      title: `${co} ${up ? "rose" : "fell"} ${abs(f.change_pct ?? 0)}%`,
      question: f.explained_by
        ? `${co} ${up ? "rose" : "fell"} ${abs(f.change_pct ?? 0)}% after a filing. Does the size of the move match what the filing says?`
        : `${co} ${up ? "rose" : "fell"} ${abs(f.change_pct ?? 0)}% on ${times(f.volume_multiple)} its usual volume, with no company filing before it. What does the market know that the filings don't say yet?`,
      observed: [
        { label: "Close", value: price(f.close) },
        { label: "Change", value: pct(f.change_pct), dir: f.change_pct },
        { label: "Volume", value: `${times(f.volume_multiple)} usual` },
      ],
      observedNote: f.other_sessions ? `${f.other_sessions} more session${f.other_sessions === 1 ? "" : "s"} met your rules in this window.` : undefined,
      unclear: "FINN reads company filings and exchange prices only. It can't see news, block deals or sector moves, so a move with no filing stays unexplained here.",
      passagesTitle: f.explained_by ? "The filing before it, and open promises" : "Filings before it, and open promises",
      passages: [...prior, ...relatedPromises(ledger, card.symbol, null, prior.length ? 1 : 2)],
      passagesEmpty: "No filing in the 30 days before, and no promise that changed recently.",
      lens: ["money", "demand"],
      revisit: "filing",
    };
  }
  if (card.kind === "management_change") {
    const p = ((card.facts.people as { name: string; role?: string; change?: string }[] | undefined) ?? [])[0];
    const surname = p?.name.split(/\s+/).pop()?.toLowerCase() ?? "";
    // what this person promised on calls, from the transcripts' own speaker lines
    const theirs = (ledger?.rows ?? [])
      .filter((r) => surname.length > 2 && [r.first_quote?.speaker, ...Object.values(r.calls).map((c) => c.quote?.speaker)].some((s) => s?.toLowerCase().includes(surname)))
      .slice(0, 3)
      .map((r) => promisePassage(r, card.symbol));
    const role = (p?.role ?? "").split(/,| and /).map((x) => x.trim()).filter(Boolean).pop() ?? "a senior role";
    return {
      ...base,
      question: p
        ? `${p.name} (${role}) is ${/resign|cessation|retir|vacat/i.test(p.change ?? "") ? "leaving" : "changing role"}. Who owns their commitments now, and was this planned?`
        : `What does this change in leadership mean for what management has promised?`,
      observed: p ? [{ label: "Who", value: p.name }, { label: "Role", value: role }] : [],
      unclear: "A filing states who and when. Why, and who takes over the work, is rarely in it.",
      passagesTitle: theirs.length ? `What ${p!.name.split(/\s+/)[0]} promised on calls` : "Open promises at risk of changing hands",
      passages: theirs.length ? theirs : relatedPromises(ledger, card.symbol, null, 2),
      passagesEmpty: ledger ? "No open promises to check against." : "No promises ledger for this company yet.",
      lens: ["rules", "execution", "money"],
      revisit: "call",
    };
  }
  const kindQ: Record<string, string> = {
    m_and_a: `What does ${co} get from this deal, what does it pay, and how does it fit what management has said about growth?`,
    litigation: `How large could this become for ${co}, and over what timescale?`,
    credit_rating: `What moved the rating, and does it change ${co}'s cost of borrowing?`,
    fund_raise: `Why is ${co} raising money now, and what will it be spent on?`,
    capex: `Is this new capacity or orders in line with what management promised, and when does it earn?`,
    earnings_call: `What did ${co} say on this call that differs from the last one?`,
  };
  return {
    ...base,
    question: kindQ[card.kind] ?? `What does this change for ${co}, if anything?`,
    observed: [],
    observedNote: card.why ?? undefined,
    unclear: "The filing states what happened. Why it matters is a judgement to check against the company's own record.",
    passagesTitle: "Open promises to check it against",
    passages: relatedPromises(ledger, card.symbol, card.kind === "capex" ? /order|capacity|capex|plant|facility|production/i : null, 3),
    passagesEmpty: ledger ? "No promise in the last four calls bears on it." : "No promises ledger for this company yet.",
    lens: card.kind === "litigation" || card.kind === "credit_rating" ? ["rules", "money"] : card.kind === "capex" ? ["execution", "demand"] : ["money", "demand"],
    revisit: "filing",
  };
}

export function fromPromise(row: PromiseRow, ledger: Ledger, snap: Snapshot): Investigation {
  const title = promiseTitle(row.title);
  const company = snap.names[ledger.symbol] ?? ledger.symbol;
  // related: promises sharing a distinctive word of the metric ("order", "margin", a programme name)
  const words = new Set(row.metric.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const rows = ledger.rows.includes(row) ? ledger.rows : (ledger.reference?.rows ?? []);
  const related = rows
    .filter((r) => r.id !== row.id && (r.metric.toLowerCase().match(/[a-z]{4,}/g) ?? []).some((w) => words.has(w)))
    .sort((a, b) => Number(ATTENTION.has(b.latest)) - Number(ATTENTION.has(a.latest)) || (b.mentions ?? 1) - (a.mentions ?? 1))
    .slice(0, 3)
    .map((r) => promisePassage(r, ledger.symbol));
  return {
    kind: "promise",
    kicker: "Promise",
    symbol: ledger.symbol,
    company,
    title,
    question: promiseQuestion(row, ledger.calls, title),
    observed: [],
    unclear:
      row.evidence_source === "per management"
        ? "The outcome is management's own later statement for the same period, not an audited figure."
        : "FINN compares what management said on each call. Whether it happened is checked only when management states a figure for the same period.",
    passagesTitle: "Related promises from the same calls",
    passages: related,
    passagesEmpty: "No other promise on the same metric in the last four calls.",
    promise: row,
    lens: promiseLens(row.metric),
    sources: [],
    revisit: "call",
  };
}
