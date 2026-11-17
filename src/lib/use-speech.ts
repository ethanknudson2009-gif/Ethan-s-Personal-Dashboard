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

export function useSpeech(onText: (text: string, final: boolean) => void) {
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
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      callback.current(text.trim(), final);
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
