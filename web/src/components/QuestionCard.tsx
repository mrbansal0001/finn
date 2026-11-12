import Link from "next/link";

/**
 * Wherever a question is offered (layout plan §9.3): tint, a kicker, the question in the serif, and
 * "Investigate ›" as the link at the end. The card is the call-out, so no black button is needed.
 * `compact` is the row form used in lists ("Worth your attention").
 */
export function QuestionCard({ question, href, kicker = "The question it raises" }: { question: string; href: string; kicker?: string }) {
  return (
    <section className="mt-6 rounded-xl bg-tint px-4 py-4" aria-label={kicker}>
      <p className="kicker text-ink-3">{kicker}</p>
      <p className="mt-1.5 font-serif text-subhead text-ink">
        {question}{" "}
        {/* the link closes the question, so the card stays one block (layout plan §4 wireframe) */}
        <Link href={href} className="tap whitespace-nowrap font-sans text-small font-medium text-accent">
          Investigate <span aria-hidden>›</span>
        </Link>
      </p>
    </section>
  );
}

export function QuestionRow({ tag, question, href }: { tag: string; question: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex min-h-[56px] items-start gap-3 py-3">
        <span className="tag mt-0.5 shrink-0">{tag}</span>
        <span className="line-clamp-2 min-w-0 flex-1 text-body text-ink group-hover:underline">{question}</span>
        <span aria-hidden className="mt-0.5 shrink-0 text-accent">
          ›
        </span>
      </Link>
    </li>
  );
}
