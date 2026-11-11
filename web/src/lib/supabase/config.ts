// Supabase is optional: without these env vars the app reads the worker's local export.

function clean(v: string | undefined): string {
  // tolerate copy-paste artefacts in dashboard env settings: spaces, quotes, trailing slash
  return (v ?? "").trim().replace(/^["']|["']$/g, "").trim().replace(/\/+$/, "");
}

function normaliseUrl(v: string): string {
  if (!v) return "";
  // a URL copied from rendered text can arrive as a Markdown link "[https://x](https://x)": take the first URL
  const embedded = v.match(/https?:\/\/[^\s\]\)"'<>]+/);
  if (embedded) v = embedded[0];
  const withScheme = /^https?:\/\//.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL. Expected something like https://<project-ref>.supabase.co ` +
        `(Supabase → Project Settings → API → Project URL). Got ${v.length} characters starting "${v.slice(0, 12)}…".`,
    );
  }
}

export const SUPABASE_URL = normaliseUrl(clean(process.env.NEXT_PUBLIC_SUPABASE_URL));
export const SUPABASE_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
