// The payload the worker exports (worker/src/finn_worker/export.py) and the app reads.

export type Tier = "lead" | "notable" | "routine";

export type Source = { label: string; url: string | null; page: number | null };

export type NetworkLine = {
  contact_id: string;
  name: string;
  relation: string;     // the evidence, e.g. "worked at Bosch with him, 2014–16"
  strength: "strong" | "medium" | "weak";
  last_contact: string | null; // ISO date
  confidence: "certain" | "dates overlap" | "same organisation" | "second degree";
  via?: string | null;
  insider?: boolean;
};

export type Contact = {
  id: string;
  name: string;
  current: { org: string; role: string };
  history: { org: string; symbol: string | null; role: string; function: string; start: string; end: string | null }[];
  education: { school: string; degree: string; year: number }[];
  domains: string[];
  city: string;
  interactions_12m: number;
  last_contact: string | null;
  reciprocity: number;
  rating: number;
  how_met: string;
};

export type ResultValues = Record<string, number | string | null>;

export type ResultsFacts = {
  period_end: string;
  nature: string;
  reporting: string;
  source: string;
  source_url: string | null;
  check: string;
  values: ResultValues;
  comparatives: null | {
    current: Record<string, number | null>;
    qoq: Record<string, number | null>;
    yoy: Record<string, number | null>;
    is_bank?: boolean;
  };
};

export type Card = {
  id: string;
  symbol: string;
  company: string;
  kind: string;
  tier: Tier;
  at: string;
  nse_subject: string;
  headline: string | null;
  headline_source: "rule" | "model" | "xbrl" | "pending";
  why: string | null;
  facts: { results?: ResultsFacts } & Record<string, unknown>;
  sources: Source[];
  network: NetworkLine[];
  score: number;
  needs_read: boolean;
};

export type Edition = {
  since: string;
  until: string;
  leads: Card[];
  more: Card[];
  routine: [string, number][];
  routine_total: number;
  counts: { filings: number; cards: number };
};

export type Holding = { symbol: string; sector: string; size: string; weight: number };

export type Snapshot = {
  generated_at: string;
  data_until: string;
  portfolio: Holding[];
  research_set: string[];
  names: Record<string, string>;
  editions: Record<WindowKey, Edition>;
  results: Record<string, ResultsFacts>;
  prices: Record<string, { close: number; change_pct: number; volume_multiple: number; day: string }>;
  people: Record<string, NetworkLine[]>;
  verifiers: Record<string, NetworkLine>;
  contacts: Contact[];
};

export type WindowKey = "24h" | "3d" | "7d" | "30d";

// ---- Promises ledger

export type PromiseStatus = "delivered" | "partly" | "missed" | "silent" | "revised" | "early" | "conflict";

export type LedgerCell = { status: PromiseStatus | null; note?: string; missed_then_reset?: boolean };

export type PromiseRow = {
  id: string;
  title: string;            // "FY27 revenue growth ~15%"
  metric: string;
  calls: Record<string, LedgerCell>; // call label -> cell
  latest: PromiseStatus;
  evidence_source: "filed" | "per management" | "not checkable";
  first_quote: { text: string; call: string; page: number; speaker?: string; url?: string } | null;
  latest_quote?: { text: string; call: string; page: number; url?: string };
  verdict: string;
  mentions?: number;        // how many calls stated it (model-built ledgers)
};

export type ArSnapshot = {
  year: number;
  url: string;
  pages: [number, number];
  what_they_do: { text: string; quote: string; page: number }[];
  segments: { name: string; share_of_revenue_pct?: number | null; quote: string; page: number }[];
};

export type Ledger = {
  snapshot?: ArSnapshot | null;
  symbol: string;
  calls: { label: string; date: string; url: string }[];
  rows: PromiseRow[];
  provenance: string;
};
