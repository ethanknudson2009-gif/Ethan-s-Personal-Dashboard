"use client";

/**
 * Speech-to-text with the browser's built-in recognizer (free, no account).
 * Works in Chrome/Edge and Safari. iPhone home-screen apps sometimes don't
 * allow it, so `supported` tells the screen to fall back to the keyboard's
 * own dictation microphone, which always works.
 *
 * It keeps listening until you tap stop, so you can talk for minutes: a
 * whole to-do list in one go. Browsers stop listening on their own after a
 * pause or a minute; we quietly start again and stitch the pieces together
 * (see speech-join.ts). Long silence (about 8 seconds) ends it.
 *
 * iPhone care: only one recognizer may hold the mic at a time, and a stopped
 * one sometimes never lets go. So the last one is always cut off (abort)
 * before a new one starts, even if it belonged to a sheet you already
 * closed, and if a fresh start hears nothing at all we quietly try once more.
 */
import { playSound, quietForMic } from "@/lib/sound";
import { useCallback, useEffect, useRef, useState } from "react";
import { joinHeard } from "@/lib/speech-join";

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

/** The recognizer holding the mic right now, from any screen. */
let live: Recognition | null = null;

/** Cut off whatever recognizer still holds the mic. */
function release(r: Recognition | null = live) {
  if (!r) return;
  try {
    r.abort();
  } catch {
    /* already gone */
  }
  if (live === r) live = null;
}

/** Stop after this much silence, or this long in total. */
const SILENCE_MS = 8000;
const MAX_MS = 5 * 60 * 1000;
/** Nothing at all heard this long after tapping the mic → start a fresh recognizer once. */
const STUCK_MS = 4000;

/**
 * `onText` gets every way the recognizer heard you (best guess first) so the
 * screen can pick the one that matches your classes and dates best. The text
 * is everything said since you tapped the mic.
 */
export function useSpeech(onText: (alternatives: string[], final: boolean) => void) {
  // Only used after a tap (client side), so checking the browser right away is safe.
  const [supported, setSupported] = useState(() => getRecognizer() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  });

  // Everything heard in earlier rounds (the recognizer restarts during a long talk).
  const kept = useRef("");
  // This round's best text so far (kept when the round ends).
  const round = useRef("");
  const wanted = useRef(false);
  const startedAt = useRef(0);
  const lastHeard = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stuckCheck = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Points at listenOnce, so a round that ends can start the next one.
  const again = useRef<() => boolean>(() => false);

  const finish = useCallback(() => {
    const wasListening = wanted.current;
    wanted.current = false;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (stuckCheck.current) clearTimeout(stuckCheck.current);
    stuckCheck.current = null;
    const r = rec.current;
    try {
      r?.stop(); // lets it hand over its last words
    } catch {
      /* already stopped */
    }
    // If it hasn't let go of the mic shortly after, cut it off so the next tap works.
    setTimeout(() => {
      if (r && live === r && rec.current === r && !wanted.current) release(r);
      if (wanted.current) return; // you already tapped the mic again
      quietForMic(false);
      if (wasListening) playSound("micOff");
    }, 700);
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      quietForMic(false);
      if (timer.current) clearInterval(timer.current);
      if (stuckCheck.current) clearTimeout(stuckCheck.current);
      release(rec.current);
      rec.current = null;
    },
    [],
  );

  /** Start one round of listening. Returns false if the browser refused. */
  const listenOnce = useCallback((): boolean => {
    const R = getRecognizer();
    if (!R) return false;
    // Whatever had the mic before (this screen's last round, or a closed sheet) goes first.
    release();
    const r = new R();
    r.lang = "en-US";
    r.continuous = true; // keep going through pauses
    r.interimResults = true; // show words as you speak
    r.maxAlternatives = 3; // a few guesses for the last bit; we keep the one that makes most sense
    round.current = "";
    r.onresult = (e) => {
      if (rec.current !== r) return;
      lastHeard.current = Date.now();
      // Finished pieces use their best guess, joined with a pause between them;
      // the piece still being spoken offers all its guesses.
      let before = kept.current;
      const last = e.results.length - 1;
      for (let i = 0; i < last; i++) before = joinHeard(before, e.results[i][0].transcript, true);
      const lastResult = e.results[last];
      const alternatives: string[] = [];
      for (let k = 0; k < lastResult.length; k++) alternatives.push(joinHeard(before, lastResult[k].transcript, true));
      const best = alternatives[0] ?? before;
      round.current = best;
      callback.current(alternatives.length ? alternatives : [before], lastResult.isFinal);
    };
    r.onerror = (e) => {
      if (rec.current !== r) return;
      if (e.error === "no-speech" || e.error === "aborted") return; // a quiet moment; onend decides
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone blocked: use the 🎤 on your keyboard instead");
        setSupported(false);
      } else if (e.error === "network") {
        setError("Voice needs internet. Try again, or use the 🎤 on your keyboard.");
      } else {
        setError("Voice stopped: tap the mic to keep going, or use the 🎤 on your keyboard");
      }
      finish();
    };
    r.onend = () => {
      if (live === r) live = null;
      if (rec.current !== r) return;
      // Keep what this round heard, then listen again (unless you tapped stop).
      if (round.current) kept.current = round.current;
      const now = Date.now();
      const quietTooLong = now - lastHeard.current > SILENCE_MS;
      const tooLong = now - startedAt.current > MAX_MS;
      if (!wanted.current || quietTooLong || tooLong) return finish();
      setTimeout(() => {
        if (!wanted.current) return;
        if (!again.current()) finish();
      }, 60);
    };
    rec.current = r;
    live = r;
    try {
      r.start();
      return true;
    } catch {
      live = null;
      return false;
    }
  }, [finish]);
  useEffect(() => {
    again.current = listenOnce;
  }, [listenOnce]);

  const start = useCallback(() => {
    if (!getRecognizer()) {
      setSupported(false);
      return false;
    }
    setError(null);
    // Tapping the mic again after stopping adds to what's already there.
    kept.current = "";
    quietForMic(true);
    wanted.current = true;
    startedAt.current = Date.now();
    lastHeard.current = startedAt.current;
    setSeconds(0);
    if (!listenOnce()) {
      wanted.current = false;
      quietForMic(false);
      setSupported(false);
      return false;
    }
    setListening(true);
    // The "mic is on but no words come through" case: start over once with a new recognizer.
    if (stuckCheck.current) clearTimeout(stuckCheck.current);
    const began = startedAt.current;
    stuckCheck.current = setTimeout(() => {
      stuckCheck.current = null;
      if (!wanted.current || startedAt.current !== began || lastHeard.current !== began) return;
      const old = rec.current;
      rec.current = null; // its onend is ignored now
      release(old);
      setTimeout(() => {
        if (wanted.current && !listenOnce()) finish();
      }, 150);
    }, STUCK_MS);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      // Some browsers never end a round on their own: stop after a long silence.
      if (Date.now() - lastHeard.current > SILENCE_MS + 2000) finish();
    }, 500);
    return true;
  }, [finish, listenOnce]);

  /** Keep listening and add on to `soFar` (tap the mic again to continue). */
  const resume = useCallback(
    (soFar: string) => {
      const ok = start();
      if (ok) kept.current = soFar.trim();
      return ok;
    },
    [start],
  );

  return { supported, listening, error, seconds, start, resume, stop: finish };
}
