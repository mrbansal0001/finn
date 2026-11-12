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
      <span aria-hidden className="text-caption">{speaking ? "■" : "▶"}</span>
      {speaking ? "Stop" : failed ? "Try again" : "Listen"}
    </button>
  );
}
