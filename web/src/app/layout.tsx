import type { Metadata, Viewport } from "next";
import { Suspense, ViewTransition } from "react";
import { Fraunces, Geist } from "next/font/google";
import { NavTracker } from "@/components/BackLink";
import { NavProgress } from "@/components/NavProgress";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
// Fraunces for headlines (variable: weight, optical size, softness); plan §4.2
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", style: ["normal", "italic"], axes: ["SOFT", "opsz"] });

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
    <html lang="en-IN" className={`${geist.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <head>
        {/* per-device display choices (theme, colour-blind palette), applied before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,t=localStorage.getItem("finn_theme");if(localStorage.getItem("finn_cb")==="1")d.dataset.cb="1";if(t==="light"||t==="dark")d.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        {/* Phone-width column everywhere: the product is designed for one thumb. */}
        <Suspense fallback={null}>
          <NavTracker />
          {/* a thin bar at the top while a tapped page is on its way (13 Nov) */}
          <NavProgress />
        </Suspense>
        <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] min-[400px]:px-5 md:max-w-[560px] min-[1100px]:has-[main.wide-page]:max-w-[1080px]">
          {/* pages crossfade on navigation (160 ms; off under reduced motion) */}
          <ViewTransition>{children}</ViewTransition>
        </div>
      </body>
    </html>
  );
}
