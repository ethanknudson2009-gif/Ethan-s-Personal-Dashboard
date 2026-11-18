"use client";

/**
 * Speech-to-text with the browser's built-in recognizer (free, no account).
 * Works in Chrome/Edge and Safari. iPhone home-screen apps sometimes don't
 * allow it, so `supported` tells the screen to fall back to the keyboard's
 * own dictation microphone, which always works.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getRecognizer(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * `onText` gets every way the recognizer heard you (best guess first) so the
 * screen can pick the one that matches your classes and dates best.
 */
export function useSpeech(onText: (alternatives: string[], final: boolean) => void) {
  // Only used after a tap (client side), so checking the browser right away is safe.
  const [supported, setSupported] = useState(() => getRecognizer() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  });

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const R = getRecognizer();
    if (!R) {
      setSupported(false);
      return false;
    }
    setError(null);
    const r = new R();
    r.lang = "en-US";
    r.continuous = false; // stops by itself after a pause
    r.interimResults = true; // show words as you speak
    r.maxAlternatives = 5; // several guesses at what you said; we keep the one that makes most sense
    r.onresult = (e) => {
      // Everything before the last piece uses its best guess; the last piece
      // offers all its alternatives.
      let before = "";
      let final = false;
      const last = e.results.length - 1;
      for (let i = 0; i < last; i++) before += e.results[i][0].transcript;
      const lastResult = e.results[last];
      const alternatives: string[] = [];
      for (let k = 0; k < lastResult.length; k++) alternatives.push(`${before}${lastResult[k].transcript}`.trim());
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) final = true;
      callback.current(alternatives.length ? alternatives : [before.trim()], final);
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone blocked: use the 🎤 on your keyboard instead"
          : e.error === "no-speech"
            ? "Didn't hear anything. Try again."
            : "Voice isn't available here: use the 🎤 on your keyboard",
      );
      if (e.error === "service-not-allowed" || e.error === "not-allowed") setSupported(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
      return true;
    } catch {
      setSupported(false);
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
