import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/components/OgCard";
import { findCard, getSnapshot } from "@/lib/data";
import { KIND_LABEL } from "@/lib/format";

export const alt = "A filing in FINN";
export const size = OG_SIZE;
export const contentType = "image/png";

// public market data only: the card's headline, never anything from the visitor's network
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = findCard(await getSnapshot(), id);
  return new ImageResponse(
    <OgCard
      kicker={card ? [KIND_LABEL[card.kind] ?? "Filing", card.symbol] : ["Filing"]}
      title={card ? (card.headline ?? card.nse_subject) : "A filing in FINN"}
      foot={card ? card.company.replace(/ Limited$/i, "") : undefined}
    />,
    size,
  );
}
