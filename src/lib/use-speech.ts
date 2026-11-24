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
 * The recognizer itself lives in speech-engine.ts: one shared one, reused
 * every time (iPhone only reliably listens with the first one a page makes).
 * If a start hears nothing at all for a few seconds, we try once more with a
 * brand-new recognizer, and if that fails too, the screen says so and shows
 * the mic log.
 */
import { playSound, quietForMic } from "@/lib/sound";
import { useCallback, useEffect, useRef, useState } from "react";
import { joinHeard } from "@/lib/speech-join";
import { listen, micLog, micTapped, recognizerAvailable, type RecognitionResults, type Round } from "@/lib/speech-engine";

/** Stop after this much silence, or this long in total. */
const SILENCE_MS = 8000;
const MAX_MS = 5 * 60 * 1000;
/** No words at all this long after tapping the mic → try once more with a new recognizer. */
const STUCK_MS = 4000;

/**
 * `onText` gets every way the recognizer heard you (best guess first) so the
 * screen can pick the one that matches your classes and dates best. The text
 * is everything said since you tapped the mic.
 */
export function useSpeech(onText: (alternatives: string[], final: boolean) => void) {
  // Only used after a tap (client side), so checking the browser right away is safe.
  const [supported, setSupported] = useState(() => recognizerAvailable());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  // What the mic did (shown when it heard nothing, so a phone problem can be seen).
  const [log, setLog] = useState("");
  const [heardNothing, setHeardNothing] = useState(false);
  const rec = useRef<Round | null>(null);
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
  const triedFresh = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Points at listenOnce, so a round that ends can start the next one.
  const again = useRef<(fresh?: boolean) => boolean>(() => false);

  const finish = useCallback(() => {
    const wasListening = wanted.current;
    wanted.current = false;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const r = rec.current;
    r?.stop(); // lets it hand over its last words
    // If it hasn't let go of the mic shortly after, cut it off so the next tap works.
    setTimeout(() => {
      if (wanted.current) return; // you already tapped the mic again
      if (r?.isCurrent()) r.abort();
      quietForMic(false);
      if (wasListening) playSound("micOff");
      setLog(micLog());
    }, 700);
    if (wasListening) setHeardNothing(lastHeard.current === startedAt.current);
    setLog(micLog());
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      quietForMic(false);
      if (timer.current) clearInterval(timer.current);
      rec.current?.abort();
      rec.current = null;
    },
    [],
  );

  /** Start one round of listening. Returns false if the browser refused. */
  const listenOnce = useCallback(
    (fresh = false): boolean => {
      round.current = "";
      const mine: { r: Round | null } = { r: null };
      const isMine = () => rec.current !== null && rec.current === mine.r;
      mine.r = listen(
        {
          result: (results: RecognitionResults) => {
            if (!isMine()) return;
            lastHeard.current = Date.now();
            // Finished pieces use their best guess, joined with a pause between them;
            // the piece still being spoken offers all its guesses.
            let before = kept.current;
            const last = results.length - 1;
            for (let i = 0; i < last; i++) before = joinHeard(before, results[i][0].transcript, true);
            const lastResult = results[last];
            const alternatives: string[] = [];
            for (let k = 0; k < lastResult.length; k++) alternatives.push(joinHeard(before, lastResult[k].transcript, true));
            round.current = alternatives[0] ?? before;
            callback.current(alternatives.length ? alternatives : [before], lastResult.isFinal);
          },
          error: (e) => {
            if (!isMine()) return;
            if (e === "no-speech" || e === "aborted") return; // a quiet moment; end decides
            if (e === "not-allowed" || e === "service-not-allowed") {
              setError("Microphone blocked: use the 🎤 on your keyboard instead");
              setSupported(false);
            } else if (e === "network") {
              setError("Voice needs internet. Try again, or use the 🎤 on your keyboard.");
            } else {
              setError("Voice stopped: tap the mic to keep going, or use the 🎤 on your keyboard");
            }
            finish();
          },
          end: () => {
            if (!isMine()) return;
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
          },
        },
        { fresh },
      );
      rec.current = mine.r;
      return mine.r !== null;
    },
    [finish],
  );
  useEffect(() => {
    again.current = listenOnce;
  }, [listenOnce]);

  const start = useCallback(() => {
    if (!recognizerAvailable()) {
      setSupported(false);
      return false;
    }
    setError(null);
    setHeardNothing(false);
    micTapped();
    // Tapping the mic again after stopping adds to what's already there.
    kept.current = "";
    quietForMic(true);
    wanted.current = true;
    startedAt.current = Date.now();
    lastHeard.current = startedAt.current;
    triedFresh.current = false;
    setSeconds(0);
    setLog("");
    if (!listenOnce()) {
      wanted.current = false;
      quietForMic(false);
      setSupported(false);
      return false;
    }
    setListening(true);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      const now = Date.now();
      setSeconds(Math.floor((now - startedAt.current) / 1000));
      setLog(micLog());
      const nothingYet = lastHeard.current === startedAt.current;
      // The "mic is on but no words come through" case: once, start over with a brand-new recognizer.
      if (nothingYet && !triedFresh.current && now - startedAt.current > STUCK_MS) {
        triedFresh.current = true;
        if (!listenOnce(true)) finish();
        return;
      }
      // Some browsers never end a round on their own: stop after a long silence.
      if (now - lastHeard.current > SILENCE_MS + 2000) finish();
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

  return { supported, listening, error, seconds, log, heardNothing, start, resume, stop: finish };
}
