import type { Contact, NetworkLine } from "./types";

/**
 * "What are you trying to understand?" Different people for different questions (creative review §4).
 * A person fits a lens by the recorded function of their role (the role at the company in question first,
 * else any role), never by guesswork. A lens nobody fits is shown as empty, not filled with a weaker match.
 */
export type LensKey = "execution" | "demand" | "money" | "rules";

export const LENSES: { key: LensKey; label: string; ask: string; roles: string; fns: RegExp }[] = [
  {
    key: "execution",
    label: "Execution",
    ask: "how it gets built, made and delivered",
    roles: "operations, projects or manufacturing",
    fns: /operations|manufactur|supply chain|projects?|sourcing|EPC|commission|programmes?|plant|engineering/i,
  },
  {
    key: "demand",
    label: "Demand",
    ask: "who buys, how much and why",
    roles: "sales, strategy or customer-facing",
    fns: /sales|strategy|category|exports?|retail|marketing|delivery|IT services|distribution|customer/i,
  },
  {
    key: "money",
    label: "Money",
    ask: "costs, margins, funding and the accounts",
    roles: "finance, credit or audit",
    fns: /finance|investor relations|M&A|investment|credit|risk|audit|equity research|investing|portfolio|treasury/i,
  },
  {
    key: "rules",
    label: "Rules",
    ask: "regulation, legal exposure and governance",
    roles: "legal, compliance or regulatory",
    fns: /compliance|legal|litigation|regulat|board|classification|procurement|policy/i,
  },
];

export type LensPerson = {
  line: NetworkLine;
  /** the role this lens rests on, said plainly: "Manager, Finance at Titan Company, 2016–22" */
  basis: string;
  lenses: LensKey[];
};

/** The lenses a contact fits for a company: by their role there, else by any recorded role. */
export function lensesFor(c: Contact | undefined, symbol: string): { lenses: LensKey[]; basis: string } {
  if (!c) return { lenses: [], basis: "" };
  const there = c.history.filter((h) => h.symbol === symbol);
  const pool = there.length ? there : c.history;
  const fit = (h: Contact["history"][number]) => LENSES.filter((l) => l.fns.test(h.function) || l.fns.test(h.role)).map((l) => l.key);
  const lenses = [...new Set(pool.flatMap(fit))];
  const h = pool.find((x) => fit(x).length) ?? pool[0];
  const basis = h ? `${h.role} at ${h.org}, ${span(h.start, h.end)}` : "";
  return { lenses, basis };
}

export function peopleByLens(lines: NetworkLine[], contacts: Contact[], symbol: string): LensPerson[] {
  return lines.map((line) => {
    const c = contacts.find((x) => x.id === line.contact_id);
    const { lenses, basis } = lensesFor(c, symbol);
    return { line, basis, lenses };
  });
}

const yr = (s: string) => s.slice(0, 4);
export const span = (start: string, end: string | null) => (end ? `${yr(start)}–${yr(end).slice(2)}` : `${yr(start)}–now`);

/** Tie strength, mirroring worker network.strength (recency, frequency, reciprocity, your rating). */
export function strengthParts(c: Contact, today: Date) {
  const days = c.last_contact ? Math.round((today.getTime() - new Date(c.last_contact).getTime()) / 86_400_000) : 3650;
  const recency = 0.4 * Math.exp(-Math.max(days, 0) / 180);
  const frequency = 0.25 * Math.min(1, Math.log1p(c.interactions_12m) / Math.log1p(24));
  const reciprocity = 0.2 * c.reciprocity;
  const rating = 0.15 * (c.rating / 5);
  return { recency, frequency, reciprocity, rating, total: recency + frequency + reciprocity + rating, days };
}

export const tieLabel = (s: number) => (s >= 0.6 ? "strong" : s >= 0.4 ? "medium" : "weak");

export type Topic = "numbers" | "target" | "amount" | "move" | "event";

export function topicOf(kind: string): Topic {
  return kind === "results" ? "numbers" : kind === "promise" || kind === "capex" ? "target" : kind === "move" ? "move" : "event";
}

/** Three questions to ask, by lens and by what is being investigated; an insider only about public context. */
export function questionsFor(lens: LensKey, company: string, insider: boolean, topic: Topic = "event"): string[] {
  const co = company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
  const q: Record<Topic, Record<LensKey, string[]>> = {
    numbers: {
      execution: [`Which operating costs usually swing from quarter to quarter at ${co}?`, "Does the mix of work or products this quarter look like it repeats, or a one-off?", "What would you watch in next quarter's numbers?"],
      demand: [`Is ${co}'s revenue this quarter from steady customers, or from a few large orders?`, "Is pricing helping or hurting right now?", "What would a competitor say about the quarter?"],
      money: [`Which cost lines usually move ${co}'s margin the most?`, "How should one read the one-off items in these numbers?", "Does anything here change how you think about its cash or funding?"],
      rules: ["Is any provision or regulatory item in these numbers likely to recur?", "Are there disputes that could change the reported profit later?", "What disclosure would you read first in the notes?"],
    },
    // a figure (capex, revenue, an order size): what drives revisions and what would substantiate it
    amount: {
      execution: ["What has to be built, bought or won for this figure to hold?", "What usually makes a plan like this get revised: scope, prices or timing?", "What disclosed progress would show it is on track?"],
      demand: ["Is the demand behind this figure already visible in orders or bookings?", "What would make customers commit more slowly than planned?", "How have similar figures in this industry played out?"],
      money: ["What drives revisions to a figure like this: scope, prices or timing?", "What disclosed progress would substantiate it?", "How does it fit the company's cash and funding?"],
      rules: ["Do any approvals or rules limit how fast this can happen?", "Is anything in this figure contingent on a government or regulator decision?", "What would delay it outside the company's control?"],
    },
    // a date: what decides whether it holds
    target: {
      execution: [`When ${co} sets a date like this, what usually decides whether it holds?`, "Where does a ramp-up like this tend to slip: approvals, equipment, people or customers?", "What would you look for next quarter to know it's on track?"],
      demand: [`Who is the customer for this, and what makes them commit or delay?`, "Is the order or demand behind this target already visible?", "How have similar targets in this industry played out?"],
      money: ["What does hitting or missing this target do to margins and cash?", "Is the target set conservatively or aggressively, from what you've seen?", "What spending has to happen first for it to be met?"],
      rules: ["What approvals does this target depend on, and who gives them?", "How long do those approvals usually take?", "What could delay it outside the company's control?"],
    },
    move: {
      execution: ["Is there anything operational the market could be reacting to?", "Have peers in the same business moved too?", "What would you check first?"],
      demand: ["Has anything changed for this industry's customers recently?", "Are peers seeing the same thing?", "Is this the kind of move that reverses?"],
      money: [`How do you usually read a move like this in ${co}: flows, news or fundamentals?`, "Is there a funding or ownership event that could explain it?", "What would make you take it seriously?"],
      rules: ["Is there a regulatory decision pending that could explain it?", "Would the company have to disclose it if it were material?", "What would you look for in the next filings?"],
    },
    event: {
      execution: [`What does this change for how ${co} runs day to day?`, "Who takes over the work it touches?", "What would you watch over the next two quarters?"],
      demand: ["How will customers or partners read this?", "Does it change the company's competitive position?", "What would a competitor make of it?"],
      money: ["What does this cost, and how is it paid for?", "Does it change the earnings or cash outlook?", "How does it compare with similar moves you've seen?"],
      rules: ["How do matters like this usually play out, and over what timescale?", "What approvals or rulings does the outcome depend on?", "What would make this more serious than it looks today?"],
    },
  };
  // a current employee: two questions, both about what is already public (D-031)
  return insider ? q[topic][lens].slice(0, 2).map((x) => `From what's public, ${x[0].toLowerCase()}${x.slice(1)}`) : q[topic][lens];
}
