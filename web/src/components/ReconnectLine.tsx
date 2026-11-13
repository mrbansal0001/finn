import Link from "next/link";
import type { Reconnect } from "@/lib/warm";
import { monthYear, shortDay } from "@/lib/format";
import { Avatar } from "./Avatar";

/** One natural reason to reconnect, as a row that opens the person with the filing as the note's subject. */
export function ReconnectLine({ r }: { r: Reconnect }) {
  const co = r.card.company.replace(/ Limited$/i, "").replace(/ Ltd\.?$/i, "");
  return (
    <Link href={`/people/${r.contact.id}?from=${encodeURIComponent(r.card.id)}`} className="group flex items-start gap-3 py-2.5">
      <span className="mt-0.5">
        <Avatar name={r.contact.name} size={24} />
      </span>
      <span className="min-w-0 flex-1 text-small">
        <span className="font-medium text-ink group-hover:underline">{r.contact.name}</span>
        {r.insider && <span className="tag ml-1.5 align-[1px]">Insider</span>}
        {/* the reason is the filing itself, in its own words */}
        <span className="mt-0.5 line-clamp-2 block text-ink-2">
          {co}, {shortDay(r.card.at)}: {r.card.headline ?? r.card.nse_subject}
        </span>
        <span className="block text-caption text-ink-3">
          Last spoke {r.contact.last_contact ? `${monthYear(r.contact.last_contact)}${r.months ? `, ${r.months} months ago` : ""}` : "a long time ago"}.{" "}
          {r.insider ? "Works there now" : "Was"} {r.role}.
        </span>
      </span>
      <span aria-hidden className="go mt-0.5">›</span>
    </Link>
  );
}
