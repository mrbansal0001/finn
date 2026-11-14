"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_PREFS, KIND_CHOICES, parsePrefs, PREFS_COOKIE, type Prefs } from "@/lib/prefs";
import { supabaseEnabled } from "@/lib/supabase/config";
import { supabaseForRequest } from "@/lib/supabase/server";

export async function savePrefs(form: FormData) {
  const enabled = new Set(form.getAll("kind").map(String));
  const prefs = parsePrefs(
    JSON.stringify({
      price_pct: form.get("price_pct"),
      volume_x: form.get("volume_x"),
      leads: form.get("leads"),
      muted: KIND_CHOICES.map((k) => k.kind).filter((k) => !enabled.has(k)),
      alert_kinds: form.getAll("alert_kind").map(String),
    }),
  );
  (await cookies()).set(PREFS_COOKIE, JSON.stringify(prefs), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  await syncPushRules(prefs);
  redirect("/");
}

export async function resetPrefs() {
  (await cookies()).delete(PREFS_COOKIE);
  // the notification rules reset too: one save/reset path for the page and the phone (full review F10)
  await syncPushRules(DEFAULT_PREFS);
  redirect("/settings");
}

/** A device with notifications on follows the same rules as the page, from the next close. A failure is logged,
 *  not swallowed (full review F10); the page's own rules are saved either way. */
async function syncPushRules(prefs: Prefs): Promise<void> {
  if (!supabaseEnabled) return;
  const db = await supabaseForRequest();
  const { error } = await db
    .from("push_subscriptions")
    .update({ prefs: { price_pct: prefs.price_pct, volume_x: prefs.volume_x, alert_kinds: prefs.alert_kinds } })
    .neq("endpoint", "");
  if (error && !/relation|does not exist|schema cache/i.test(error.message)) console.error("push rules not updated:", error.message);
}

// browser push services only (full review F08): the worker sends to this address, so nothing else is accepted
const PUSH_HOST = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)$/;
const B64URL = /^[A-Za-z0-9_-]+=*$/;

function validSubscription(endpoint: string, p256dh: string, auth: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  // a P-256 public key is 65 bytes (87 base64url characters); the auth secret is 16 bytes (22)
  return u.protocol === "https:" && !u.port && PUSH_HOST.test(u.hostname) && endpoint.length < 1000
    && B64URL.test(p256dh) && p256dh.replace(/=+$/, "").length === 87 && B64URL.test(auth) && auth.replace(/=+$/, "").length === 22;
}

// ---- notifications (brief-check plan, part 1): the visitor's own private rows, under row-level security ----

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function subscribePush(sub: Sub): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseEnabled) return { ok: false, error: "Notifications need the live site; this copy runs without a database." };
  const endpoint = sub.endpoint ?? "", p256dh = sub.keys?.p256dh ?? "", auth = sub.keys?.auth ?? "";
  if (!validSubscription(endpoint, p256dh, auth)) return { ok: false, error: "This browser's push service isn't supported, or the subscription was incomplete." };
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  const db = await supabaseForRequest();
  await db.from("push_subscriptions").delete().eq("endpoint", endpoint);       // re-subscribing the same browser
  const { error } = await db.from("push_subscriptions").insert({
    endpoint, p256dh, auth,
    prefs: { price_pct: prefs.price_pct, volume_x: prefs.volume_x, alert_kinds: prefs.alert_kinds },
  });
  if (!error) return { ok: true };
  if (/relation|does not exist|schema cache/i.test(error.message)) return { ok: false, error: "Notifications aren't switched on for this server yet." };
  if (/row-level security/i.test(error.message)) return { ok: false, error: "This session already has three devices with notifications on." };
  return { ok: false, error: "Couldn't save the subscription. Try again in a minute." };
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  if (!supabaseEnabled || !endpoint) return;
  const db = await supabaseForRequest();
  await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
