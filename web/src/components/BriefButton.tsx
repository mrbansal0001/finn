"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Edition } from "@/lib/types";

const canSpeakNow = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Reads the edition aloud with the phone's own speech engine (no cost, no network). Hidden where unsupported. */
export function BriefButton({ edition, alerts = 0 }: { edition: Edition; alerts?: number }) {
  const [speaking, setSpeaking] = useState(false);
  const [failed, setFailed] = useState(false);
  const canSpeak = useSyncExternalStore(() => () => {}, canSpeakNow, () => false);
  const utter = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!canSpeak) return null;

  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const n = edition.leads.length;
    const lines = [
      n ? `${n} ${n === 1 ? "thing matters" : "things matter"}.` : "No single item leads this window.",
      alerts ? `${alerts} price or volume ${alerts === 1 ? "alert" : "alerts"} at the close.` : "",
      ...edition.leads.map((c) => `${c.company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "")}. ${c.headline ?? c.nse_subject}. ${c.why ?? ""}`),
      edition.more.length ? `${edition.more.length} more worth a look, and ${edition.routine_total} routine filings folded.` : "",
      "End of edition.",
    ];
    const u = new SpeechSynthesisUtterance(lines.filter(Boolean).join(" "));
    u.lang = "en-IN";
    u.rate = 1.05;
    u.onend = () => setSpeaking(false);
    u.onerror = () => {
      setSpeaking(false);
      setFailed(true);
    };
    utter.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
    setFailed(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-2 text-small text-ink-2 hover:text-ink"
    >
      <span aria-hidden className="text-caption">{speaking ? "■" : "▶"}</span>
      {failed ? "Couldn't play" : speaking ? "Stop" : "Listen"}
    </button>
  );
}
