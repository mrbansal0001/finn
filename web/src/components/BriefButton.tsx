"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const canSpeakNow = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Reads the edition aloud with the phone's own speech engine (no cost, no network). Hidden where unsupported. */
export function BriefButton({ script }: { script: string }) {
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
      setFailed(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(script);
    u.lang = "en-IN";
    u.rate = 1.05;
    u.onend = () => setSpeaking(false);
    u.onerror = (e) => {
      setSpeaking(false);
      // stopping it ourselves reports "interrupted"/"canceled": that's not a failure
      if (e.error !== "interrupted" && e.error !== "canceled") setFailed(true);
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
      {/* drawn, not ▶/■ characters: iPhones can render ▶ as a coloured emoji (13 Nov) */}
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="shrink-0">
        {speaking ? <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" /> : <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l7-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5z" fill="currentColor" />}
      </svg>
      {speaking ? "Stop" : failed ? "Try again" : "Listen"}
    </button>
  );
}
