import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FINN: your portfolio, briefed",
    short_name: "FINN",
    description: "NSE filings ranked, routine folded, management promises tracked, and the people who can explain them.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#16150f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
