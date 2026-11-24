"use client";

/**
 * The one speech recognizer the whole app shares.
 *
 * Why only one: on iPhone, the recognizer a page makes first works, but the
 * ones made after it can light up the mic and still hear nothing. So we make
 * one and start it again for every round of listening. If a round goes quiet
 * anyway (no sound at all), use-speech asks for a `fresh` one as a backup.
 *
 * Only one round runs at a time. Starting a new round while an old one is
 * still going cuts the old one off first, then starts once it has let go.
 *
 * It also keeps a short log of what the mic did ("start, audio, words, end")
 * so a problem on a phone can be seen on screen instead of guessed at.
 */

export type RecognitionResults = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: RecognitionResults }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type Ctor = new () => Recognition;

export type RoundHandlers = {
  result: (results: RecognitionResults) => void;
  error: (error: string) => void;
  end: () => void;
};

export type Round = { stop: () => void; abort: () => void; isCurrent: () => boolean };

export function recognizerAvailable(): boolean {
  return getCtor() !== null;
}

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── The mic log ─────────────────────────────────────────────────────────────
let tapAt = 0;
let log: string[] = [];
let wordsLogged = false;

function note(what: string) {
  const s = ((Date.now() - tapAt) / 1000).toFixed(1);
  log.push(`${what} ${s}s`);
  if (log.length > 16) log = log.slice(-16);
}

/** Call when you tap the mic: the log starts over. */
export function micTapped() {
  tapAt = Date.now();
  log = [];
  wordsLogged = false;
}

/** "start 0.1s · audio 0.3s · words 1.2s · end 6.0s" */
export function micLog(): string {
  return log.join(" · ");
}

// ── The shared recognizer ───────────────────────────────────────────────────
type Live = { id: number; h: RoundHandlers };

let inst: Recognition | null = null;
let running = false;
let current: Live | null = null;
let queued: Live | null = null;
let seq = 0;

function make(C: Ctor): Recognition {
  const r = new C();
  r.lang = "en-US";
  r.continuous = true; // keep going through pauses
  r.interimResults = true; // show words as you speak
  r.maxAlternatives = 3; // a few guesses; use-speech keeps the one that makes most sense
  r.onstart = () => r === inst && note("start");
  r.onaudiostart = () => r === inst && note("audio");
  r.onsoundstart = () => r === inst && note("sound");
  r.onspeechstart = () => r === inst && note("speech");
  r.onresult = (e) => {
    if (r !== inst) return;
    if (!wordsLogged) {
      wordsLogged = true;
      note("words");
    }
    current?.h.result(e.results);
  };
  r.onerror = (e) => {
    if (r !== inst) return;
    note(`error:${e.error}`);
    current?.h.error(e.error);
  };
  r.onend = () => {
    if (r !== inst) return; // an old recognizer we already replaced
    note("end");
    running = false;
    const done = current;
    current = null;
    done?.h.end();
    if (queued && !running) {
      const next = queued;
      queued = null;
      begin(next);
    }
  };
  return r;
}

function cutOff(r: Recognition | null) {
  try {
    r?.abort();
  } catch {
    /* already gone */
  }
}

function begin(live: Live): boolean {
  const C = getCtor();
  if (!C) return false;
  if (!inst) inst = make(C);
  current = live;
  try {
    inst.start();
    running = true;
    return true;
  } catch {
    // This one is in a bad state: replace it and try once more.
    note("retry");
    const old = inst;
    inst = make(C);
    cutOff(old);
    try {
      inst.start();
      running = true;
      return true;
    } catch {
      note("start-failed");
      current = null;
      return false;
    }
  }
}

/**
 * Start one round of listening. `fresh` throws the shared recognizer away
 * and makes a new one first (the backup when a round heard nothing at all).
 * Returns null if the browser has no recognizer or refused to start.
 */
export function listen(h: RoundHandlers, opts: { fresh?: boolean } = {}): Round | null {
  const C = getCtor();
  if (!C) return null;
  const live: Live = { id: ++seq, h };
  const round: Round = {
    isCurrent: () => current === live || queued === live,
    stop: () => {
      if (queued === live) queued = null;
      if (current === live) {
        try {
          inst?.stop();
        } catch {
          /* already stopped */
        }
      }
    },
    abort: () => {
      if (queued === live) queued = null;
      if (current === live) cutOff(inst);
    },
  };

  if (opts.fresh && inst) {
    note("fresh");
    const old = inst;
    inst = null;
    running = false;
    current = null;
    queued = null;
    cutOff(old);
  }

  if (!running) return begin(live) ? round : null;

  // The last round hasn't let go yet: cut it off, start this one when it ends.
  current = null; // its end isn't news to anyone now
  queued = live;
  cutOff(inst);
  setTimeout(() => {
    if (queued !== live) return;
    // It never ended: give up on that recognizer and use a new one.
    note("stuck");
    queued = null;
    const old = inst;
    inst = null;
    running = false;
    cutOff(old);
    if (!begin(live)) h.error("start-failed");
  }, 600);
  return round;
}
