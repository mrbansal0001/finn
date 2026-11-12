import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/components/OgCard";

export const alt = "FINN: a daily edition for a public-markets investor";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgCard kicker={["Edition"]} title="What changed in the portfolio, what each company promised, and who can explain it." />, size);
}
