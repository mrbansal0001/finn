"use client";

import { useRef, useState, useSyncExternalStore } from "react";

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecCtor = new () => Rec;

const ctor = (): RecCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Voice in (brief: "chat, voice, a copilot…"): the phone's own speech recognition fills the search, so what
 * you say goes through the same company, person, theme and "who knows" handling as what you type. With Listen,
 * that's a hands-free loop: hear the edition, then ask. Audio stays with the phone's speech service; FINN only
 * receives the words. Hidden where the browser has no recogniser.
 */
export function VoiceButton({ onText }: { onText: (text: string, final: boolean) => void }) {
  const supported = useSyncExternalStore(() => () => {}, () => !!ctor(), () => false);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const rec = useRef<Rec | null>(null);
  if (!supported) return null;
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? "Stop listening" : "Speak instead of typing"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (on) {
            rec.current?.stop();
            return;
          }
          const R = ctor();
          if (!R) return;
          const r = new R();
          r.lang = "en-IN";
          r.interimResults = true;
          r.maxAlternatives = 1;
          r.onresult = (e) => {
            const res = e.results[e.results.length - 1];
            onText(res[0].transcript.trim().replace(/[.?!]$/, ""), res.isFinal);
          };
          r.onend = () => setOn(false);
          r.onerror = (e) => {
            setOn(false);
            if (e.error === "not-allowed" || e.error === "service-not-allowed") setErr("Microphone access is off for this site.");
            else if (e.error !== "aborted" && e.error !== "no-speech") setErr("Didn't catch that; try again.");
          };
          rec.current = r;
          setErr("");
          setOn(true);
          r.start();
        }}
        className={`absolute right-0.5 top-0 inline-flex size-11 items-center justify-center rounded-lg ${on ? "text-accent" : "text-ink-3 hover:text-ink"}`}
      >
        {on && <span aria-hidden className="absolute size-7 animate-ping rounded-full bg-accent/20 motion-reduce:animate-none" />}
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
      </button>
      <span role="status" className="sr-only">
        {on ? "Listening" : ""}
      </span>
      {(on || err) && (
        <p className="absolute -top-7 left-0 rounded-full bg-ink px-3 py-1 text-caption text-paper">{on ? "Listening…" : err}</p>
      )}
    </>
  );
}
