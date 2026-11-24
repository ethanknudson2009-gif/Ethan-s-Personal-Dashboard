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
 * Two ways of listening, because iPhones differ:
 *   "long"  one shared recognizer, continuous (hears you through pauses)
 *   "short" a new recognizer every round, one phrase at a time; use-speech
 *           restarts it after each phrase, so a long talk still works
 *   "frame" like "short", but each recognizer lives in its own brand-new
 *           blank page (a hidden frame) that is thrown away afterward.
 *           Ethan's iPhone (iOS 18.7, home-screen app) only ever heard
 *           words on the first tap after opening the app: the mic is tied
 *           to the page, so every listen gets a new page.
 * use-speech switches to another way when a tap hears nothing and
 * remembers (on this device) whichever way last heard words.
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

export type MicMode = "long" | "short" | "frame";
const MODE_KEY = "mic-mode";

/** The way of listening that last heard words on this device. */
export function savedMicMode(): MicMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    return m === "short" || m === "long" ? m : "frame";
  } catch {
    return "frame";
  }
}

export function saveMicMode(mode: MicMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode: just don't remember it */
  }
}

export type Round = { stop: () => void; abort: () => void; isCurrent: () => boolean };

export function recognizerAvailable(): boolean {
  return getCtor() !== null;
}

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── A dead mic ──────────────────────────────────────────────────────────────
// When the phone hands us a mic that hears nothing even after a fresh start,
// stop pretending: for the rest of this visit the mic button opens the
// keyboard instead, whose own 🎤 dictation always works.
let dead = false;
export function markMicDead() {
  dead = true;
}
export function micIsDead(): boolean {
  return dead;
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

/** Add a line to the mic log from outside ("wake-ok"). */
export function noteMic(what: string) {
  note(what);
}

/** Call when you tap the mic: the log starts over ("tap#3 long"). */
let taps = 0;
export function micTapped(mode: MicMode) {
  tapAt = Date.now();
  log = [];
  wordsLogged = false;
  taps++;
  log.push(`tap#${taps} ${mode}`);
}

/** "start 0.1s · audio 0.3s · words 1.2s · end 6.0s" */
export function micLog(): string {
  return log.join(" · ");
}

// ── The shared recognizer ───────────────────────────────────────────────────
type Live = { id: number; h: RoundHandlers; mode: MicMode };

let inst: Recognition | null = null;
let running = false;
let current: Live | null = null;
let queued: Live | null = null;
let seq = 0;

// "frame" recognizers and the hidden blank page each one lives in.
const frames = new WeakMap<Recognition, HTMLIFrameElement>();

/** A recognizer from a brand-new hidden blank page (same site, mic allowed). */
function frameCtor(): { C: Ctor; frame: HTMLIFrameElement } | null {
  if (typeof document === "undefined") return null;
  const frame = document.createElement("iframe");
  frame.setAttribute("allow", "microphone");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;width:1px;height:1px;left:-10px;top:-10px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);
  // No src: the frame keeps its first blank page, which is ready right away.
  const w = frame.contentWindow as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor } | null;
  const C = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  if (!C) {
    frame.remove();
    return null;
  }
  return { C, frame };
}

function make(C: Ctor, mode: MicMode = "long"): Recognition {
  let frame: HTMLIFrameElement | null = null;
  if (mode === "frame") {
    const f = frameCtor();
    if (f) {
      C = f.C;
      frame = f.frame;
    } else note("no-frame");
  }
  const r = new C();
  if (frame) frames.set(r, frame);
  r.lang = "en-US";
  r.continuous = mode === "long"; // keep going through pauses, or one phrase per round
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
    const page = frames.get(r);
    if (page) setTimeout(() => page.remove(), 500);
    if (r !== inst) return; // an old recognizer we already replaced
    note("end");
    running = false;
    const done = current;
    current = null;
    done?.h.end();
    if (queued && !running) {
      const next = queued;
      queued = null;
      begin(next, next.mode);
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
  // Throw its blank page away once it has let go.
  const frame = r ? frames.get(r) : undefined;
  if (frame) setTimeout(() => frame.remove(), 1500);
}

let instMode: MicMode = "long";

function begin(live: Live, mode: MicMode): boolean {
  const C = getCtor();
  if (!C) return false;
  if (inst && instMode !== mode) {
    const old = inst;
    inst = null;
    cutOff(old);
  }
  instMode = mode;
  if (!inst) inst = make(C, mode);
  current = live;
  try {
    inst.start();
    running = true;
    return true;
  } catch {
    // This one is in a bad state: replace it and try once more.
    note("retry");
    const old = inst;
    // A frame that won't start: retry with a normal recognizer.
    inst = make(C, mode === "frame" ? "short" : mode);
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
export function listen(h: RoundHandlers, opts: { fresh?: boolean; mode?: MicMode } = {}): Round | null {
  const C = getCtor();
  if (!C) return null;
  const mode = opts.mode ?? "long";
  // "short" and "frame" never reuse a recognizer: every round gets a new one.
  const fresh = opts.fresh || mode !== "long";
  const live: Live = { id: ++seq, h, mode };
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

  if (fresh && inst) {
    if (opts.fresh) note(`switch:${mode}`);
    const old = inst;
    inst = null;
    running = false;
    current = null;
    queued = null;
    cutOff(old);
  }

  if (!running) return begin(live, mode) ? round : null;

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
    if (!begin(live, mode)) h.error("start-failed");
  }, 600);
  return round;
}
