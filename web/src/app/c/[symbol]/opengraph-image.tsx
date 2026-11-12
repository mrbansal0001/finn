import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/components/OgCard";
import { getSnapshot, getUniverse } from "@/lib/data";

export const alt = "A company in FINN";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  let sym = symbol;
  try {
    sym = decodeURIComponent(symbol).toUpperCase();
  } catch {}
  const [snap, uni] = await Promise.all([getSnapshot(), getUniverse()]);
  const name = (snap.names[sym] ?? uni.find(([s]) => s === sym)?.[1] ?? sym).replace(/ Limited$/i, "");
  const e = snap.ledger_index?.[sym];
  return new ImageResponse(
    <OgCard
      kicker={["Company", sym]}
      title={name}
      foot={e ? `${e.rows} promises read from its last four earnings calls` : "Filings, results and promises from primary documents"}
    />,
    size,
  );
}
