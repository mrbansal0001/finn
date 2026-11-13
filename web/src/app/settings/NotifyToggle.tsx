"use client";

import { useEffect, useState } from "react";
import { VAPID_PUBLIC_KEY } from "@/lib/push";
import { subscribePush, unsubscribePush } from "./actions";

// Push that pushes (brief-check plan, part 1): this device gets the filings chosen above as they land, and
// the alerts that meet the rules once at each close. The switch is the only place a subscription is made.

type State = "loading" | "unsupported" | "ios" | "denied" | "off" | "on" | "busy";

function key(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
}

export function NotifyToggle() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    let next: Promise<State>;
    // iPhone allows web push only for a site added to the Home Screen (iOS 16.4+)
    if (!supported) next = Promise.resolve(ios && !standalone ? "ios" : "unsupported");
    else if (Notification.permission === "denied") next = Promise.resolve("denied");
    else next = registration().then((r) => r.pushManager.getSubscription()).then((s) => (s ? "on" : "off")).catch(() => "off" as State);
    let live = true;
    void next.then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  async function turnOn() {
    setState("busy");
    setMsg("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC_KEY) }));
      const res = await subscribePush(sub.toJSON() as Parameters<typeof subscribePush>[0]);
      if (!res.ok) {
        await sub.unsubscribe();
        setMsg(res.error ?? "Couldn't switch notifications on.");
        setState("off");
        return;
      }
      // a local confirmation, so the investor sees what a FINN notification looks like straight away
      await reg.showNotification("FINN notifications are on", {
        body: "Filings you chose, as they land, and your alerts once at each close.",
        icon: "/icon-192.png",
        tag: "finn-on",
      });
      setState("on");
    } catch {
      setMsg("This browser refused the subscription. Try again, or use Chrome, Edge, Firefox or Safari.");
      setState("off");
    }
  }

  async function turnOff() {
    setState("busy");
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }

  const on = state === "on";
  const usable = state === "on" || state === "off" || state === "busy";
  return (
    <div id="notify" className="mt-4 scroll-mt-16 rounded-lg bg-tint px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-ink">Notify this device</p>
          <p className="text-caption text-ink-3">
            {on
              ? "On. Filings above as they land, and your price and volume alerts once at each close."
              : "Filings above as they land, and your price and volume alerts once at each close."}
          </p>
        </div>
        {usable && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Notify this device"
            disabled={state === "busy"}
            onClick={() => void (on ? turnOff() : turnOn())}
            className={`relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full transition-colors ${on ? "bg-accent" : "bg-ink-3/40"} disabled:opacity-60`}
          >
            <span className={`inline-block size-6 rounded-full bg-paper shadow transition-transform ${on ? "translate-x-[24px]" : "translate-x-1"}`} />
          </button>
        )}
      </div>
      {state === "ios" && (
        <p className="mt-2 text-small text-ink-2">
          On iPhone, notifications work once FINN is on your Home Screen: tap Share, then Add to Home Screen, and open FINN from there.
        </p>
      )}
      {state === "unsupported" && <p className="mt-2 text-small text-ink-2">This browser can&apos;t receive web notifications.</p>}
      {state === "denied" && (
        <p className="mt-2 text-small text-ink-2">Notifications are blocked for this site. Allow them in the browser&apos;s site settings, then come back.</p>
      )}
      {msg && (
        <p role="status" className="mt-2 text-small text-ink">
          {msg}
        </p>
      )}
      <p className="mt-2 text-caption text-ink-3">
        FINN checks the exchange every 15 minutes while its updater runs. The demo session, and its notifications, end 14 days after your first visit.
      </p>
    </div>
  );
}
