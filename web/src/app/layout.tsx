import type { Metadata, Viewport } from "next";
import { Suspense, ViewTransition } from "react";
import { Geist, Newsreader } from "next/font/google";
import { NavTracker } from "@/components/BackLink";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "FINN",
  description: "Your portfolio, briefed. NSE filings ranked, routine folded, promises tracked.",
  appleWebApp: { capable: true, title: "FINN", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${geist.variable} ${newsreader.variable}`}>
      <body>
        {/* Phone-width column everywhere: the product is designed for one thumb. */}
        <Suspense fallback={null}>
          <NavTracker />
        </Suspense>
        <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] md:max-w-[560px]">
          {/* pages crossfade on navigation (160 ms; off under reduced motion) */}
          <ViewTransition>{children}</ViewTransition>
        </div>
      </body>
    </html>
  );
}
