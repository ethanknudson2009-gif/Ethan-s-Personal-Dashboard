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
 * The recognizer itself lives in speech-engine.ts, which has three ways of
 * listening ("frame", "short", "long"). If a tap hears nothing for a few
 * seconds we go down a ladder, all in the same tap:
 *   1. the way that last worked on this device
 *   2. another way
 *   3. wake the mic directly (getUserMedia), then a brand-new frame
 * The way that hears words is remembered. If none do, the screen says so,
 * and the mic button opens the keyboard's 🎤 for the rest of the visit.
 */
import { audioSessionType, playSound, quietForMic, soundsOn } from "@/lib/sound";
import { reportMicAction } from "@/lib/mic-report";
import { useCallback, useEffect, useRef, useState } from "react";
import { joinHeard } from "@/lib/speech-join";
import { listen, markMicDead, micIsDead, micLog, micTapped, noteMic, recognizerAvailable, savedMicMode, saveMicMode, type MicMode, type RecognitionResults, type Round } from "@/lib/speech-engine";

/** The way to try next time after a tap that heard nothing. */
const NEXT: Record<MicMode, MicMode> = { frame: "short", short: "long", long: "frame" };

/** Step 2 of the ladder: a frame if we didn't start with one (and frames are allowed), else the other normal way. */
function secondWay(first: MicMode, frameBlocked: boolean): MicMode {
  if (first !== "frame" && !frameBlocked) return "frame";
  return first === "short" ? "long" : "short";
}

/**
 * Turn the mic on directly for a moment, then off again: on iPhone this can
 * wake a mic that the recognizer is getting no sound from.
 */
async function wakeMic() {
  try {
    const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
    noteMic("wake-ok");
    stream?.getTracks().forEach((t) => t.stop());
  } catch (e) {
    noteMic(`wake:${(e as Error)?.name ?? "failed"}`);
  }
}

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
  // Which step of the ladder this tap is on, and when it began.
  const stage = useRef(0);
  const stageAt = useRef(0);
  const frameBlocked = useRef(false);
  const mode = useRef<MicMode>("long");
  const sessionType = useRef("none");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Goes one step down the ladder (false when there are no steps left).
  const nextStep = useRef<() => boolean>(() => false);
  // Points at listenOnce, so a round that ends can start the next one.
  const again = useRef<(fresh?: boolean) => boolean>(() => false);

  const finish = useCallback(() => {
    const wasListening = wanted.current;
    const heardWords = lastHeard.current !== startedAt.current;
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
      if (wasListening) sendReport(heardWords, sessionType.current);
    }, 700);
    if (wasListening) {
      const nothing = lastHeard.current === startedAt.current;
      setHeardNothing(nothing);
      // Next tap starts with the other way of listening.
      if (nothing) saveMicMode(NEXT[savedMicMode()]);
      // The whole ladder tried and still nothing: the phone's mic is dead for this visit.
      if (nothing && stage.current >= 2) markMicDead();
    }
    setLog(micLog());
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      // Closed the screen while listening: still send what the mic did.
      if (wanted.current) sendReport(lastHeard.current !== startedAt.current, "closed");
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
            if (lastHeard.current === startedAt.current) saveMicMode(mode.current); // this way works here
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
            if ((e === "not-allowed" || e === "service-not-allowed") && mode.current === "frame") {
              // This phone won't let a hidden frame use the mic: use the normal way from now on.
              noteMic("frame-blocked");
              frameBlocked.current = true;
              mode.current = "short";
              saveMicMode("short");
              if (!again.current(true)) finish();
              return;
            }
            if (e === "not-allowed" || e === "service-not-allowed") {
              setError("Microphone blocked: use the 🎤 on your keyboard instead");
              setSupported(false);
            } else if (e === "audio-capture") {
              // The phone gave us a mic with no sound (iPhone, after the first use): try the next way.
              if (nextStep.current()) return;
              markMicDead();
              setError("Your iPhone stopped letting the app hear you. Tap the 🎤 on your keyboard instead (it always works).");
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
            const quietTooLong = now - Math.max(lastHeard.current, stageAt.current) > SILENCE_MS;
            const tooLong = now - startedAt.current > MAX_MS;
            if (!wanted.current || quietTooLong || tooLong) return finish();
            setTimeout(() => {
              if (!wanted.current) return;
              if (!again.current()) finish();
            }, 60);
          },
        },
        { fresh, mode: mode.current },
      );
      rec.current = mine.r;
      return mine.r !== null;
    },
    [finish],
  );
  useEffect(() => {
    again.current = listenOnce;
    nextStep.current = () => {
      if (!wanted.current || stage.current >= 2 || lastHeard.current !== startedAt.current) return false;
      stage.current++;
      stageAt.current = Date.now();
      if (stage.current === 1) {
        mode.current = secondWay(mode.current, frameBlocked.current);
        if (!listenOnce(true)) finish();
      } else {
        mode.current = frameBlocked.current ? "short" : "frame";
        // Let go of the mic before waking it (detached first, so its "ended" doesn't restart anything).
        const old = rec.current;
        rec.current = null;
        old?.abort();
        void wakeMic().then(() => {
          if (wanted.current && !listenOnce(true)) finish();
        });
      }
      return true;
    };
  }, [listenOnce, finish]);

  const start = useCallback(() => {
    if (!recognizerAvailable()) {
      setSupported(false);
      return false;
    }
    // The mic went dead earlier this visit: the screen opens the keyboard's 🎤 instead.
    if (micIsDead()) return false;
    setError(null);
    setHeardNothing(false);
    mode.current = savedMicMode();
    micTapped(mode.current);
    // Tapping the mic again after stopping adds to what's already there.
    kept.current = "";
    quietForMic(true);
    sessionType.current = audioSessionType();
    wanted.current = true;
    startedAt.current = Date.now();
    lastHeard.current = startedAt.current;
    stage.current = 0;
    stageAt.current = startedAt.current;
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
      // The "mic is on but no words come through" case: next step of the ladder.
      if (nothingYet && now - stageAt.current > STUCK_MS && nextStep.current()) return;
      // Some browsers never end a round on their own: stop after a long silence.
      if (now - Math.max(lastHeard.current, stageAt.current) > SILENCE_MS + 2000) finish();
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

/** What the mic did goes to the server log (timings only, never your words) so phone problems can be seen. */
function sendReport(heardWords: boolean, session: string) {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  void reportMicAction({
    log: micLog().slice(0, 600),
    heardWords,
    standalone,
    sounds: soundsOn(),
    session,
    agent: navigator.userAgent.slice(0, 300),
  }).catch(() => {});
}
