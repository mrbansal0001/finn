import type { Card, Ledger, PromiseRow, ResultsFacts, Snapshot, Source } from "./types";
import { croreFromCr, fyQuarter, pct, price, times, KIND_LABEL } from "./format";
import type { LensKey, Topic } from "./lenses";

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
  topic: Topic;           // which prepared questions fit (a date target is not an amount target)
};

/** A promise about a date (commissioning, an order "by June") or about a figure (capex ₹1,200 cr). */
export function promiseTopic(row: PromiseRow): Topic {
  const t = (row as PromiseRow & { target?: { kind?: string | null } }).target;
  if (t?.kind === "milestone") return "target";
  if (/\bdate\b|deadline|commission|launch|start|timeline/i.test(`${row.metric} ${row.title}`)) return "target";
  const notes = Object.values(row.calls).map((c) => c.note ?? "").join(" ");
  if (/₹|%|\bcr\b|crore|\d+\s*(?:bn|mn|x)\b/i.test(`${row.title} ${notes}`)) return "amount";
  return /\bby\b|date|deadline|commission|launch|start|order/i.test(`${row.metric} ${row.title}`) ? "target" : "amount";
}

const short = (s: string) => s.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
const abs = (v: number) => Math.abs(v).toFixed(1);

// ---------------------------------------------------------------- results

/** The question a results table raises, from its own figures. Order: the most specific signal first. */
export function resultsQuestion(r: ResultsFacts): { q: string; unclear: string; focus?: RegExp } | null {
  const c = r.comparatives;
  if (!c) return null;
  const y = c.yoy, cur = c.current;
  const unclear = "The table shows what changed, not why. The notes to the results and the next earnings call are where the company explains it.";
  if (c.is_bank) {
    const prov = y.provisions, pat = y.pat, nii = y.nii;
    if (prov != null && prov >= 20) return { q: `Provisions rose ${abs(prov)}% from a year ago. Is this one book of loans, or a wider rise in stress?`, unclear };
    if (nii != null && pat != null && nii < 5 && pat > 10) return { q: `PAT rose ${abs(pat)}% while net interest income grew ${pct(nii)}. What carried the profit: lower provisions, fees or treasury gains?`, unclear };
    if (nii != null) return { q: `Net interest income ${nii >= 0 ? "grew" : "fell"} ${abs(nii)}% from a year ago. Is the margin on loans holding as rates move?`, unclear };
    return null;
  }
  const rev = y.revenue, pat = y.pat, mbp = y.ebitda_margin_bp;
  const exc = cur.exceptional, pbt = cur.pbt, ex = y.pbt_ex_exceptional;
  const pbtY0 = y.pbt;
  if (exc && pbt && Math.abs(exc) / Math.abs(pbt) >= 0.1 && pbtY0 != null && ex != null) {
    // like with like: reported PBT against PBT before the item. PAT is never "normalised" with a pre-tax
    // item: its tax effect isn't disclosed (visual review §3.3)
    return {
      q: `PBT ${pbtY0 >= 0 ? "rose" : "fell"} ${abs(pbtY0)}%, but it includes a ${croreFromCr(exc)} exceptional item. Before that item, PBT ${ex >= 0 ? "rose" : "fell"} ${abs(ex)}%. Which is the run-rate, and will the item recur?`,
      unclear: "The exceptional item is in the filed table, before tax. What it was, and whether it repeats, is in the notes to the results; its effect on PAT isn't stated, so PAT isn't adjusted here.",
      focus: /exceptional|one.?off|pbt|profit before/i,
    };
  }
  // operating profit held up but pre-tax profit didn't: the gap is below EBITDA, and the table shows it
  const ebitdaY = y.ebitda, pbtY = y.pbt;
  if (!c.is_lender && ebitdaY != null && pbtY != null && ebitdaY >= 0 && pbtY <= -20) {
    return {
      q: `EBITDA rose ${abs(ebitdaY)}% but PBT fell ${abs(pbtY)}%. The drop is below the operating line: higher depreciation, interest, or lower other income?`,
      focus: /depreciation|interest|finance cost|other income|capex|debt|borrow/i,
      unclear: "The filed table shows the gap between operating and pre-tax profit; which line caused it, and whether it lasts, is in the results' detail and the next call.",
    };
  }
  if (rev != null && mbp != null && !c.is_lender) {
    if (rev > 0 && mbp <= -50) return { q: `Revenue grew ${abs(rev)}% but the EBITDA margin fell ${Math.abs(Math.round(mbp))}bp. Which costs grew faster than sales, and is that temporary?`, unclear, focus: /margin|ebitda|cost/i };
    if (mbp >= 50) return { q: `The EBITDA margin widened ${Math.round(mbp)}bp from a year ago. Is it mix, pricing or cheaper inputs, and can it last?`, unclear, focus: /margin|ebitda|cost|mix|pric/i };
  }
  if (rev != null && pat != null) {
    if (rev < 0 && pat > 0) return { q: `Revenue fell ${abs(rev)}% while PAT rose ${abs(pat)}%. Lower costs, other income or a one-off?`, unclear, focus: /cost|margin|profit|pat/i };
    if (rev > 0 && pat < 0) return { q: `Revenue grew ${abs(rev)}% but PAT fell ${abs(pat)}%. Where did the profit go?`, unclear, focus: /margin|cost|profit|pat|ebitda/i };
    if (rev < 0 && pat < 0) return { q: `Revenue fell ${abs(rev)}% and PAT ${abs(pat)}%. Is this the industry's cycle or something specific to the company?`, unclear, focus: /revenue|growth|volume|demand/i };
    return { q: `Revenue grew ${abs(rev)}% and PAT ${abs(pat)}%. What does management expect from here, and what did it promise before?`, unclear, focus: /revenue|growth|margin|ebitda|guidance/i };
  }
  return null;
}

/** Last year's quarter, last quarter and this one, from the filed table (EBITDA ÷ revenue). */
export function marginPlot(r: ResultsFacts): MarginPlot | undefined {
  const c = r.comparatives as (ResultsFacts["comparatives"] & { prev_y?: Record<string, number | null>; prev_q?: Record<string, number | null> }) | null;
  if (!c || c.is_bank || c.is_lender) return undefined;
  const m = (x?: Record<string, number | null>) => (x?.ebitda != null && x?.revenue ? (100 * x.ebitda) / x.revenue : null);
  // every margin and the change from unrounded filed figures (a 6.3% vs 6.2% label pair can be a 9bp change)
  const now = m(c.current) ?? c.current.ebitda_margin_pct;
  const py = m(c.prev_y), pq = m(c.prev_q);
  if (now == null || py == null) return undefined;
  const q = fyQuarter(r.period_end);
  const points = [{ label: "A year ago", value: py }, ...(pq != null && r.reporting !== "Half Yearly" ? [{ label: "Last quarter", value: pq }] : []), { label: q, value: now }];
  return { points, change: (now - py) * 100, basis: `${r.nature}, EBITDA ÷ revenue; bp from unrounded figures` };
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
function relatedPromises(ledger: Ledger | null, symbol: string, metric: RegExp | null, n: number, only?: string[]): Passage[] {
  if (!ledger) return [];
  const direct = (r: PromiseRow) => !!metric && metric.test(`${r.metric} ${r.title}`);
  const score = (r: PromiseRow) =>
    (metric && metric.test(`${r.metric} ${r.title}`) ? 100 : 0) + (r.tracking ? 50 : 0) + (ATTENTION.has(r.latest) ? 20 : 0) + (r.mentions ?? 1) * 3
    - (/: (no figure|direction only)$/.test(r.title) ? 15 : 0) - (r.latest === "closed" ? 120 : 0);   // an ended period is history, not a lead
  return [...ledger.rows]
    .filter((r) => (only ? only.includes(r.latest) : metric ? direct(r) || ATTENTION.has(r.latest) : ATTENTION.has(r.latest)))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n)
    // matching passages first; anything else is labelled as context, not evidence (visual review §3.2)
    .map((r) => {
      const p = promisePassage(r, symbol);
      return metric && !direct(r) ? { ...p, label: `Context, not about this directly: ${p.label.charAt(0).toLowerCase()}${p.label.slice(1)}` } : p;
    });
}

/** A promise's investigation. Row ids are positional and can change when a ledger is rebuilt, so the
 *  title rides along and the page falls back to it (a saved question must not reopen a different promise). */
export function promiseHref(symbol: string, r: PromiseRow): string {
  return `/investigate?c=${encodeURIComponent(symbol)}&p=${encodeURIComponent(r.id)}&t=${encodeURIComponent(r.title)}`;
}

export function promisePassage(r: PromiseRow, symbol: string): Passage {
  const q = r.latest_quote ?? r.first_quote;
  return {
    label: `Promise, ${STATUS_WORD[r.latest] ?? r.latest}${q ? `, last said ${q.call}` : ""}`,
    title: promiseTitle(r.title),
    quote: q?.text,
    cite: q?.url ? { href: `${q.url}#page=${q.page}`, text: `transcript p.${q.page}` } : undefined,
    open: promiseHref(symbol, r),
  };
}

const STATUS_WORD: Record<string, string> = {
  delivered: "delivered", partly: "partly delivered", missed: "missed", revised: "revised", silent: "went silent",
  closed: "period ended", early: "open", conflict: "conflicting",
};

export function promiseTitle(t: string): string {
  const out = t.replace(/^(.*?) · ([^:]+): /, "$1 ($2): ").replace(/ · /g, ", ");
  // the worker keeps the metric as extracted ("revenue"); the reader sees a sentence-case title (three-pillars L3)
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** A title whose target is vague: the vagueness as a tag, the metric and period as the text (three-pillars L4).
 *  "Ship repair revenue (FY26): no figure" -> { text: "Ship repair revenue (FY26)", tag: "No figure" } */
export function splitPromise(t: string): { text: string; tag?: string } {
  const title = promiseTitle(t);
  const m = title.match(/^(.*?):\s*(no figure|by unspecified date|direction only)$/i);
  if (!m) return { text: title };
  const tag = /no figure/i.test(m[2]) ? "No figure" : /unspecified/i.test(m[2]) ? "No date" : "Direction only";
  return { text: m[1], tag };
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
      passages: relatedPromises(ledger, card.symbol, rq?.focus ?? /revenue|margin|ebitda|profit|pat|growth|volume|sales/i, 3),
      passagesEmpty: ledger ? "No promise on revenue, margins or profit in the last four calls." : "No promises ledger for this company yet.",
      lens: r.comparatives?.is_bank ? ["money", "rules"] : ["money", "demand", "execution"],
      revisit: "call",
      topic: "numbers",
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
        : `${co} ${up ? "rose" : "fell"} ${abs(f.change_pct ?? 0)}% on ${times(f.volume_multiple)} its usual volume, with no material filing since the previous close. Which public disclosures help put it in context?`,
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
      topic: "move",
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
      passagesTitle: theirs.length
        ? `What ${p!.name.split(/\s+/)[0]} promised on calls`
        : `None of the last four calls quotes ${p?.name ?? "them"} making a promise. The company's open commitments, which a change at the top could affect`,
      passages: theirs.length ? theirs : relatedPromises(ledger, card.symbol, null, 2, ["early", "revised"]),
      passagesEmpty: ledger ? "No open promises to check against." : "No promises ledger for this company yet.",
      lens: ["rules", "execution", "money"],
      revisit: "call",
      topic: "event",
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
    topic: card.kind === "capex" ? "amount" : "event",
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
      Object.values(row.calls).some((c) => c.evidence)
        ? "The outcome is management's own later statement for the same period, not an audited figure."
        : "FINN compares what management said on each call. Whether it happened is checked only when management states a figure for the same period.",
    passagesTitle: "Related promises from the same calls",
    passages: related,
    passagesEmpty: "No other promise on the same metric in the last four calls.",
    promise: row,
    lens: promiseLens(row.metric),
    sources: [],
    revisit: "call",
    topic: promiseTopic(row),
  };
}
