import Link from "next/link";
import type { Contact } from "@/lib/types";

/**
 * Who has seen both businesses (visual review §9): Kalyan ← Farah → Titan, with the role and the years on
 * each side. Selecting a company opens its research. Two questions that use the person's experience across
 * both, and a plain warning: experience in two firms doesn't make their financial metrics comparable.
 */
export function CompanyBridge({ name, roles }: { name: string; roles: Contact["history"] }) {
  if (roles.length < 2) return null;
  const [a, b] = roles.slice(-2); // the two most recent covered roles, older on the left
  const short = (o: string) => o.replace(/ (Limited|Ltd\.?|Company|India|Technologies)$/g, "");
  const yrs = (h: Contact["history"][number]) => `${h.start.slice(0, 4)}–${h.end ? h.end.slice(0, 4) : "now"}`;
  const first = name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.)\s*(\(retd\.\)\s*)?/, "").split(" ")[0];
  const side = (h: Contact["history"][number], align: "left" | "right") => (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <Link href={`/c/${encodeURIComponent(h.symbol!)}`} className="chip tap">
        {h.symbol}
      </Link>
      <p className="mt-1.5 text-caption text-ink-2">{h.role}</p>
      <p className="num text-caption text-ink-3">
        {yrs(h)}
        {h.end === null ? ", works there now" : ""}
      </p>
    </div>
  );
  return (
    <section className="mt-10" aria-labelledby="bridge-h">
      <h2 id="bridge-h" className="section-h">
        Has seen both
      </h2>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        {side(a, "left")}
        <div className="flex flex-col items-center pt-1" aria-hidden>
          <span className="flex items-center">
            <span className="h-px w-5 bg-ink-3" />
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-small font-medium text-paper">{first[0]}</span>
            <span className="h-px w-5 bg-ink-3" />
          </span>
          <span className="mt-1 text-caption text-ink-3">{first}</span>
        </div>
        {side(b, "right")}
      </div>
      <p className="sr-only">
        {name} was {a.role} at {a.org} ({yrs(a)}) and {b.role} at {b.org} ({yrs(b)}).
      </p>
      <p className="mt-4 text-caption text-ink-3">Questions only someone who has seen both can answer</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-small text-ink">
        <li>
          Which public operating figures mean the same thing at {short(a.org)} and {short(b.org)}, and which only look alike?
        </li>
        <li>Where does a comparison between the two break down: customers, cost structure or how they report?</li>
      </ol>
      <p className="mt-2 text-caption text-ink-3">
        Working at both doesn&apos;t make their numbers comparable; the companies&apos; own filings still decide that.
        {a.end === null || b.end === null ? " One role is current: public information only." : ""}
      </p>
    </section>
  );
}
