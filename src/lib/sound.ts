/**
 * Little sound effects, made on the fly with the browser's Web Audio API
 * (no audio files to download or license). Every sound is short and quiet:
 * feedback, not noise.
 *
 *   playSound("tap")   any button press (src/components/sound-layer.tsx)
 *   playSound("done")  something checked off
 *   playSound("saved") a save finished
 *   playSound("error") a save failed
 *   playSound("swipe") moved to the next page
 *   playSound("micOff") stopped listening
 *
 * Sounds can be turned off in Settings (saved on this device only).
 */

export type SoundName = "tap" | "done" | "undo" | "saved" | "error" | "swipe" | "micOff";

const KEY = "sounds";
let ctx: AudioContext | null = null;
let lastTap = 0;
let lastDone = -1e9;
let micOpen = false;

/**
 * iPhone Safari's audio mode (iOS 16.4+): "ambient" for our little sounds
 * (they mix in and never take over the phone's audio), "play-and-record"
 * while the mic listens, so the phone is set up to hear you.
 */
type AudioSessionType = "auto" | "ambient" | "play-and-record" | "playback";
export function setAudioSession(type: AudioSessionType) {
  if (typeof navigator === "undefined") return;
  const session = (navigator as unknown as { audioSession?: { type: AudioSessionType } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    /* older iPhone: nothing to set */
  }
}

/** The audio mode right now ("ambient"), or "none" on browsers without it. */
export function audioSessionType(): string {
  if (typeof navigator === "undefined") return "none";
  return (navigator as unknown as { audioSession?: { type: string } }).audioSession?.type ?? "none";
}

/**
 * While the mic listens, the sound engine is shut off completely. On iPhone a
 * live sound engine keeps the phone's audio in "playing" mode, and then the
 * mic turns on but hears nothing (it worked the first time only because the
 * permission popup reset the audio). Closing it hands the audio back to the
 * mic; the next sound after you're done makes a fresh one.
 */
export function quietForMic(listening: boolean) {
  micOpen = listening;
  setAudioSession(listening ? "play-and-record" : "auto");
  if (listening && ctx) {
    const old = ctx;
    ctx = null;
    void old.close().catch(() => {});
  }
}

export function soundsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode: just don't remember it */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  // Our sounds never take over the phone's audio (and never block the mic).
  setAudioSession("ambient");
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  // iPhone starts it "suspended" until a tap; every sound comes from a tap, so this wakes it.
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** One soft note: a sine (or other wave) that fades in fast and out smoothly. */
function note(a: AudioContext, freq: number, start: number, length: number, volume: number, type: OscillatorType = "sine", glideTo?: number) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + length);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(a.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** A short breath of filtered noise (the page "whoosh"). */
function whoosh(a: AudioContext, start: number) {
  const length = 0.16;
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * length), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(600, start);
  filter.frequency.exponentialRampToValueAtTime(2400, start + length);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.05, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(start);
}

export function playSound(name: SoundName) {
  if (micOpen || !soundsOn()) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  switch (name) {
    case "tap": {
      // Two taps in a row (a button inside a card) only click once.
      const now = performance.now();
      if (now - lastTap < 60) return;
      lastTap = now;
      note(a, 1500, t, 0.035, 0.035, "triangle", 900);
      break;
    }
    case "done":
      lastDone = performance.now();
      note(a, 880, t, 0.09, 0.06, "triangle");
      note(a, 1320, t + 0.06, 0.18, 0.05, "sine");
      break;
    case "undo":
      note(a, 990, t, 0.08, 0.04, "triangle", 660);
      break;
    case "saved":
      note(a, 784, t, 0.12, 0.05);
      note(a, 1047, t + 0.08, 0.22, 0.05);
      break;
    case "error":
      note(a, 330, t, 0.12, 0.05, "triangle");
      note(a, 262, t + 0.11, 0.2, 0.05, "triangle");
      break;
    case "swipe":
      whoosh(a, t);
      break;
    case "micOff":
      note(a, 1047, t, 0.1, 0.045);
      note(a, 784, t + 0.08, 0.18, 0.045);
      break;
  }
}

/** The sound for a toast message: a soft "uh-oh" for problems, a chime for the rest. */
export function playToastSound(message: string) {
  if (soundsLikeError(message)) playSound("error");
  // A check-off already made its own "ding" a moment ago.
  else if (performance.now() - lastDone > 1500) playSound("saved");
}

/** Does this message say something went wrong? ("Couldn't save: …") */
export function soundsLikeError(message: string): boolean {
  return /^(?:couldn'?t|could not|can'?t|cannot|error|failed|something went wrong|not signed in|no )/i.test(message.trim());
}
