"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KIND_CHOICES, parsePrefs, PREFS_COOKIE } from "@/lib/prefs";

export async function savePrefs(form: FormData) {
  const enabled = new Set(form.getAll("kind").map(String));
  const prefs = parsePrefs(
    JSON.stringify({
      price_pct: form.get("price_pct"),
      volume_x: form.get("volume_x"),
      leads: form.get("leads"),
      muted: KIND_CHOICES.map((k) => k.kind).filter((k) => !enabled.has(k)),
    }),
  );
  (await cookies()).set(PREFS_COOKIE, JSON.stringify(prefs), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  redirect("/");
}

export async function resetPrefs() {
  (await cookies()).delete(PREFS_COOKIE);
  redirect("/settings");
}
