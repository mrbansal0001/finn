"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KIND_CHOICES, parsePrefs, PREFS_COOKIE } from "@/lib/prefs";
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
  // a device with notifications on follows the new rules from the next close
  if (supabaseEnabled) {
    const db = await supabaseForRequest();
    await db
      .from("push_subscriptions")
      .update({ prefs: { price_pct: prefs.price_pct, volume_x: prefs.volume_x, alert_kinds: prefs.alert_kinds } })
      .neq("endpoint", "");
  }
  redirect("/");
}

export async function resetPrefs() {
  (await cookies()).delete(PREFS_COOKIE);
  redirect("/settings");
}

// ---- notifications (brief-check plan, part 1): the visitor's own private rows, under row-level security ----

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function subscribePush(sub: Sub): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseEnabled) return { ok: false, error: "Notifications need the live site; this copy runs without a database." };
  const endpoint = sub.endpoint ?? "", p256dh = sub.keys?.p256dh ?? "", auth = sub.keys?.auth ?? "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false, error: "The browser returned an incomplete subscription." };
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
