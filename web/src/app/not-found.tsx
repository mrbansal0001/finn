import Link from "next/link";

export default function NotFound() {
  return (
    <main className="pt-10">
      <h1 className="font-serif text-title">Nothing here</h1>
      <p className="mt-2 text-body text-ink-2">
        That card, person or page isn&apos;t in your edition. Cards older than 30 days drop out, and people pages exist only for
        your own network.
      </p>
      <Link href="/" className="mt-4 inline-flex min-h-[44px] items-center text-accent">‹ Back to the edition</Link>
    </main>
  );
}
