import { SUPABASE_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

/**
 * Daily Vercel Cron (vercel.json). Supabase's free plan pauses a project after a week without database
 * activity; a real query once a day keeps the demo up through the review period. Reads public data only.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!supabaseEnabled) return Response.json({ ok: true, skipped: "no database configured" });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/snapshot?id=eq.current&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: "no-store",
  });
  return Response.json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
}
