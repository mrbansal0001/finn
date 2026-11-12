/**
 * A person from the visitor's network, marked as a person (13 Nov): a small circle with their first initial,
 * the convention people know from contacts apps. Companies are outlined chips; people are initials, so the
 * two never look alike. Honorifics (Col., Dr.) are skipped so the initial is the name's.
 */
export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const first = name.replace(/^(Col\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s*(\(retd\.\)\s*)?/i, "").trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent/12 font-medium text-accent"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.52), lineHeight: 1 }}
    >
      {first}
    </span>
  );
}
