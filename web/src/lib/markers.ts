import type { Marker } from "@/components/PriceVolumeChart";
import type { Snapshot } from "./types";

/**
 * A company's filings as chart markers on the sessions shown: material cards and folded routine items,
 * each on the day it was filed (hollow when after the 15:30 close); a filing on a non-trading day sits on
 * the next session, which it preceded. Timing only, never cause.
 */
export function filingMarkers(snap: Snapshot, symbol: string, days: string[]): Marker[] {
  const ed = snap.editions["30d"];
  const filings = [
    ...[...ed.leads, ...ed.more]
      .filter((c) => c.symbol === symbol && c.kind !== "move")
      .map((c) => ({ at: c.at, title: c.headline ?? c.nse_subject, href: `/card/${c.id}`, external: false })),
    ...(ed.routine_items ?? [])
      .filter((it) => it.symbol === symbol)
      .map((it) => ({ at: it.at, title: it.label, href: it.link ?? `/c/${symbol}`, external: !!it.link })),
  ];
  return filings.flatMap((f) => {
    const d = f.at.slice(0, 10), hm = f.at.slice(11, 16);
    const onDay = days.includes(d) ? d : days.find((x) => x > d);
    if (!onDay) return [];
    const label = `${new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}, ${hm}`;
    return [{ d: onDay, time: label, afterClose: onDay === d && hm > "15:30", title: f.title, href: f.href, external: f.external }];
  });
}
