import type { ReactNode } from "react";

/**
 * What a page looks like while it is on its way (13 Nov): its own shape in soft shimmering blocks, and a
 * small line saying what is opening. Used both as the route's loading UI and as the page's own Suspense
 * fallback, so the screen never flips from a skeleton to bare text to the page.
 */
function Bar({ w = "100%", h = "1rem", className = "" }: { w?: string; h?: string; className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} style={{ width: w, height: h }} />;
}

function Shell({ label, back = "Back", children }: { label: string; back?: string; children: ReactNode }) {
  return (
    <main aria-busy="true">
      <div aria-hidden className="nav-progress nav-progress-cont" />
      {/* the back control's place, so the page doesn't jump when it arrives */}
      <p className="flex min-h-[44px] items-center gap-1 text-small text-ink-3">‹ {back}</p>
      <p className="flex items-center gap-2 text-caption text-ink-3" role="status">
        <span aria-hidden className="spinner" />
        {label}
      </p>
      <div className="mt-4">{children}</div>
    </main>
  );
}

function SectionBars({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-10">
      <Bar w="40%" h="0.75rem" />
      <span aria-hidden className="mt-2 block border-b border-rule" />
      <div className="mt-3 space-y-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <Bar key={i} w={i === rows - 1 ? "70%" : "100%"} h="0.95rem" />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <Shell label="Opening the filing…" back="Edition">
      <div className="flex items-center gap-2">
        <Bar w="4rem" h="0.75rem" />
        <Bar w="6rem" h="1.75rem" className="!rounded-full" />
      </div>
      <Bar className="mt-3" w="92%" h="1.6rem" />
      <Bar className="mt-2" w="60%" h="1.6rem" />
      <Bar className="mt-4" w="100%" h="1rem" />
      <Bar className="mt-2" w="80%" h="1rem" />
      <Bar className="mt-6" w="100%" h="11rem" />
      <Bar className="mt-6 !rounded-xl" w="100%" h="7.5rem" />
    </Shell>
  );
}

export function CompanySkeleton() {
  return (
    <Shell label="Opening the company…">
      <div className="flex items-center gap-2">
        <Bar w="3rem" h="0.75rem" />
        <Bar w="5rem" h="1.5rem" className="!rounded-full" />
      </div>
      <Bar className="mt-3" w="75%" h="2rem" />
      <Bar className="mt-3" w="40%" h="1.1rem" />
      <Bar className="mt-3" w="9.5rem" h="2.75rem" />
      <Bar className="mt-6 !rounded-full" w="100%" h="2.6rem" />
      <SectionBars rows={2} />
      <SectionBars rows={3} />
    </Shell>
  );
}

export function InvestigateSkeleton() {
  return (
    <Shell label="Preparing the investigation…">
      <div className="flex items-center gap-2">
        <Bar w="5.5rem" h="0.75rem" />
        <Bar w="6rem" h="1.75rem" className="!rounded-full" />
      </div>
      <Bar className="mt-4" w="100%" h="1.5rem" />
      <Bar className="mt-2" w="95%" h="1.5rem" />
      <Bar className="mt-2" w="55%" h="1.5rem" />
      <div className="mt-4 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <Bar key={i} w="5rem" h="2.75rem" className="!rounded-full" />
        ))}
      </div>
      <SectionBars rows={1} />
      <Bar className="mt-3" w="100%" h="10rem" />
    </Shell>
  );
}

export function PersonSkeleton() {
  return (
    <Shell label="Opening the profile…">
      <Bar w="7rem" h="0.75rem" />
      <Bar className="mt-3" w="65%" h="2rem" />
      <Bar className="mt-3" w="90%" h="1.1rem" />
      <Bar className="mt-2" w="50%" h="0.9rem" />
      <SectionBars rows={3} />
      <SectionBars rows={2} />
    </Shell>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <Shell label={label}>
      <Bar w="60%" h="2rem" />
      <Bar className="mt-3" w="90%" h="1.1rem" />
      <SectionBars rows={4} />
    </Shell>
  );
}

/** The edition while it is prepared: the masthead as it will be, then its blocks. */
export function EditionSkeleton() {
  return (
    <main aria-busy="true">
      <div aria-hidden className="nav-progress nav-progress-cont" />
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-display font-semibold tracking-[-0.02em]">FINN</h1>
        <p className="flex items-center gap-2 text-caption text-ink-3" role="status">
          <span aria-hidden className="spinner" />
          Preparing your edition…
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <Bar w="11rem" h="1.1rem" />
        <Bar w="7.5rem" h="1.75rem" className="!rounded-full" />
      </div>
      <Bar className="mt-4 !rounded-full" w="100%" h="2.9rem" />
      <Bar className="mt-3" w="85%" h="0.85rem" />
      <Bar className="mt-6 !rounded-lg" w="100%" h="9rem" />
      <SectionBars rows={2} />
      <Bar className="mt-4" w="100%" h="4.5rem" />
    </main>
  );
}
