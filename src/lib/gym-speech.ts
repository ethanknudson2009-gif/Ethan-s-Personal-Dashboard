/**
 * Reads a whole workout said in one breath and turns it into a clean,
 * standard list: which exercises, every set's weight and reps, and which
 * muscles / split day it was. Pure and tested (gym-speech.test.ts).
 *
 *   "chest day, bench 3x10 at 135 then incline dumbbell 3 sets of 8 at 50
 *    and pushups 2 sets of 20"
 *   → Chest · Bench press 3×10 @ 135 lb · Incline dumbbell press 3×8 @ 50 lb · Push-ups 2×20
 *
 * Works in any order: "135 bench 3x10", "3 sets of 10 on bench at 135",
 * "bench 135 for 10, 155 for 8, 175 for 6", "one thirty five for ten".
 */

import { libraryEntry } from "./exercise-library";
import { selfCorrect } from "./parser/spoken";

export type GymExercise = { id: string; name: string; muscle?: string; bodyweight?: boolean };
export type SpokenSet = { weightLb: number | null; reps: number | null };
export type SpokenEntry = { exerciseId: string | null; name: string; sets: SpokenSet[] };
export type SpokenWorkout = {
  entries: SpokenEntry[];
  /** Muscle groups worked, e.g. ["chest", "triceps"]. */
  muscles: string[];
  /** The split day it matches, e.g. "Back & Biceps", or null. */
  day: string | null;
  /** "skip chest day" / "skip the gym today". */
  skip: boolean;
};

export const DEFAULT_SPLIT = ["Chest", "Back & Biceps", "Legs", "Shoulders & Triceps"];

// ── Numbers said out loud ───────────────────────────────────────────────────
const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const isNumWord = (w: string) => w in UNITS || w in TENS || w === "hundred" || /^\d+(\.\d+)?$/.test(w);
const val = (w: string): number | null => (w in UNITS ? UNITS[w] : w in TENS ? TENS[w] : /^\d+(\.\d+)?$/.test(w) ? Number(w) : null);

/**
 * Turns spoken numbers into digits the gym way: "one thirty five" → 135,
 * "two twenty five" → 225, "a hundred and eighty five" → 185, "forty five" → 45.
 * Also undoes clock times the general speech cleanup made ("1:35" → 135).
 */
export function gymNumbers(text: string): string {
  // "80 pounds… excuse me I mean 60 pounds" → "60 pounds…" (people fix themselves mid-sentence).
  const words = selfCorrect(text)
    .toLowerCase()
    // The mic mishears some gym words.
    .replace(/\bschool crushers?\b/g, "skull crushers")
    .replace(/\bskull crunchers?\b/g, "skull crushers")
    .replace(/\b(?:lat|lats) pull downs?\b/g, "lat pulldown")
    .replace(/\bpull downs?\b/g, "pulldown")
    .replace(/\bdead lifts?\b/g, "deadlift")
    // "3 by 12" / "4 by 20" = 3 sets of 12.
    .replace(/\b(\d{1,2}) by (\d{1,3})\b/g, "$1 x $2")
    // "plank for 60 seconds 3 times", "135 for 10, 3 times" = 3 sets.
    .replace(/\b(\d{1,3})\s*(?:seconds?|secs?|reps?)?\s*,?\s+(\d{1,2}|two|three|four|five) times\b/g, (_m, n: string, t: string) => `${{ two: 2, three: 3, four: 4, five: 5 }[t] ?? t} x ${n}`)
    .replace(/\b([1-9]):([0-5]\d)\b/g, (_m, h: string, mm: string) => String(Number(h) * 100 + Number(mm)))
    // Gym slang: "pulled 315" is a deadlift, "squatted 225" a squat.
    .replace(/\bpulled (?=\d|a |one |two |three |four |five )/g, "deadlift ")
    .replace(/\bsquatted\b/g, "squat")
    .replace(/\bdeadlifted\b/g, "deadlift")
    // "315 for a PR" with no reps said is a single.
    .replace(/\b(\d+) for an? (?:pr|pb|new pr|personal (?:record|best))\b/g, "$1 for 1")
    .replace(/\bfor an? (?:pr|pb|new pr|personal (?:record|best))\b/g, "")
    .replace(/\b(?:a|one) plate\b/g, "1 plate")
    .replace(/\btwo plates\b/g, "2 plates")
    .replace(/\bthree plates\b/g, "3 plates")
    .replace(/\bfour plates\b/g, "4 plates")
    .replace(/\bfive plates\b/g, "5 plates")
    // "4 plates" on a leg press or sled is just the plates (45 lb each side)…
    .replace(/\b(leg press|hack squat|sled|belt squat)([^,.;]*?)\b(\d(?:\.5)?)\s*plates?\b/g, (_m, ex: string, mid: string, n: string) => `${ex}${mid}${Math.round(Number(n) * 90)}`)
    // …on a barbell it's the 45 lb bar plus a 45 on each side per plate: "3 plates" = 315.
    .replace(/\b(\d(?:\.5)?)\s*plates?\b/g, (_m, n: string) => String(45 + Math.round(Number(n) * 90)))
    .replace(/(\d)\s*(?:x|×|\*)\s*(?=\d)/g, "$1 x ")
    .replace(/(\d)(lbs?|kg|pounds|kilos)\b/g, "$1 $2")
    .replace(/\b(\d+)s\b/g, "$1") // "30s" (dumbbells) → 30
    .replace(/[,;!?]/g, " , ")
    .replace(/\.(?!\d)/g, " , ")
    .replace(/-/g, " ")
    .replace(/@/g, " at ")
    .replace(/:(?!\d)/g, " , ") // "chest day: bench…"
    .replace(/\bdbs?\b/g, "dumbbell")
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const startsNumber = isNumWord(w) || (w === "a" && words[i + 1] === "hundred");
    if (!startsNumber || w === "hundred") {
      out.push(w);
      i++;
      continue;
    }
    // Collect the run of number words ("and" allowed right after "hundred").
    const run: string[] = [];
    while (i < words.length) {
      const x = words[i];
      if (isNumWord(x) || (x === "a" && words[i + 1] === "hundred" && run.length === 0)) run.push(x);
      else if (x === "and" && run[run.length - 1] === "hundred" && i + 1 < words.length && isNumWord(words[i + 1])) {
        // "a hundred and eighty five"
      } else break;
      i++;
    }
    out.push(...readRun(run));
  }
  return out.join(" ");
}

/** One run of number words → one or more numbers. */
function readRun(run: string[]): string[] {
  const nums: string[] = [];
  let k = 0;
  while (k < run.length) {
    const w = run[k];
    // Digits stay as they are, except "1 35" (a split "one thirty five").
    if (/^\d/.test(w)) {
      const n = Number(w);
      const next = run[k + 1] !== undefined ? val(run[k + 1]) : null;
      if (n >= 1 && n <= 9 && next !== null && next >= 10 && next <= 99 && !/^\d/.test(run[k + 1] ?? "")) {
        let rest = next;
        k += 2;
        if (next % 10 === 0 && next >= 20 && run[k] !== undefined && val(run[k])! < 10 && run[k] in UNITS) rest += val(run[k++])!;
        nums.push(String(n * 100 + rest));
        continue;
      }
      nums.push(w);
      k++;
      continue;
    }
    // "a/one hundred (and) eighty five"
    if ((w === "a" || w in UNITS) && run[k + 1] === "hundred") {
      const hundreds = w === "a" ? 1 : UNITS[w];
      k += 2;
      let rest = 0;
      if (run[k] !== undefined && (run[k] in TENS || run[k] in UNITS || /^\d+$/.test(run[k]))) {
        rest = val(run[k++])!;
        if (rest >= 20 && rest % 10 === 0 && run[k] !== undefined && run[k] in UNITS && UNITS[run[k]] < 10) rest += UNITS[run[k++]];
      }
      nums.push(String(hundreds * 100 + rest));
      continue;
    }
    // "one thirty five" / "two twenty five" / "one forty": gym-speak for 135 / 225 / 140.
    if (w in UNITS && UNITS[w] >= 1 && UNITS[w] <= 9 && run[k + 1] !== undefined && (run[k + 1] in TENS || (run[k + 1] in UNITS && UNITS[run[k + 1]] >= 10))) {
      let rest = val(run[k + 1])!;
      k += 2;
      if (rest >= 20 && run[k] !== undefined && run[k] in UNITS && UNITS[run[k]] >= 1 && UNITS[run[k]] < 10) rest += UNITS[run[k++]];
      nums.push(String(UNITS[w] * 100 + rest));
      continue;
    }
    // "forty five"
    if (w in TENS) {
      let n = TENS[w];
      k++;
      if (run[k] !== undefined && run[k] in UNITS && UNITS[run[k]] >= 1 && UNITS[run[k]] < 10) n += UNITS[run[k++]];
      nums.push(String(n));
      continue;
    }
    nums.push(String(val(w)));
    k++;
  }
  return nums;
}

// ── Exercise names ──────────────────────────────────────────────────────────
/** Nicknames → the built-in exercise they mean. */
const NICKNAMES: Record<string, string> = {
  bench: "bench press", benched: "bench press", benching: "bench press", "flat bench": "bench press", "barbell bench": "bench press", "chest press": "bench press",
  incline: "incline dumbbell press", "incline bench": "incline dumbbell press", "incline press": "incline dumbbell press", "incline dumbbell": "incline dumbbell press", "incline db": "incline dumbbell press",
  pushup: "push-up", "push up": "push-up", "press up": "push-up",
  fly: "chest fly", flye: "chest fly", "pec fly": "chest fly", "pec deck": "chest fly", "cable fly": "chest fly", "dumbbell fly": "chest fly",
  squat: "squat", squatted: "squat", squatting: "squat", "back squat": "squat", "barbell squat": "squat",
  rdl: "romanian deadlift", "romanian dead lift": "romanian deadlift", "stiff leg": "romanian deadlift",
  lunge: "lunge", "walking lunge": "lunge",
  "hamstring curl": "leg curl", "lying leg curl": "leg curl", "seated leg curl": "leg curl",
  "quad extension": "leg extension",
  calf: "calf raise", "calve raise": "calf raise", "calf raise": "calf raise",
  deadlift: "deadlift", deadlifted: "deadlift", "dead lift": "deadlift",
  pullup: "pull-up", "pull up": "pull-up", chinup: "pull-up", "chin up": "pull-up",
  pulldown: "lat pulldown", "pull down": "lat pulldown", "lat pull": "lat pulldown", "lat pull down": "lat pulldown", lat: "lat pulldown",
  row: "barbell row", "bent over row": "barbell row", "barbell row": "barbell row", "dumbbell row": "barbell row",
  "cable row": "seated cable row", "seated row": "seated cable row",
  ohp: "overhead press", "shoulder press": "overhead press", "military press": "overhead press", "dumbbell shoulder press": "overhead press",
  "lateral raise": "lateral raise", "side raise": "lateral raise", "lat raise": "lateral raise", lateral: "lateral raise", "side lateral": "lateral raise",
  "rear delt": "rear delt fly", "reverse fly": "rear delt fly", "face pull": "rear delt fly",
  curl: "bicep curl", curled: "bicep curl", "bicep curl": "bicep curl", "barbell curl": "bicep curl", "dumbbell curl": "bicep curl", "ez bar curl": "bicep curl",
  "hammer curl": "hammer curl", hammer: "hammer curl",
  pushdown: "tricep pushdown", "push down": "tricep pushdown", "tricep pushdown": "tricep pushdown", "tricep push down": "tricep pushdown", "rope pushdown": "tricep pushdown", "tricep extension": "tricep pushdown", "cable pushdown": "tricep pushdown",
  "skull crusher": "skull crusher", "skullcrusher": "skull crusher",
  dip: "dip",
  plank: "plank (second)",
  crunch: "crunch", situp: "crunch", "sit up": "crunch",
  "leg raise": "hanging leg raise", "hanging leg raise": "hanging leg raise",
};

/** Lowercase words, light singular ("squats" → "squat", "presses" → "press"). */
function normWord(w: string): string {
  if (w.length <= 2) return w;
  if (w.endsWith("sses")) return w.slice(0, -2); // presses → press
  if (w.endsWith("es") && /(ch|sh|x)es$/.test(w)) return w.slice(0, -2); // crunches → crunch
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}
export function normPhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(normWord)
    .join(" ");
}

/** Every phrase that names an exercise → that exercise. Longer phrases win when scanning. */
function phraseBook(exercises: GymExercise[]): Map<string, GymExercise> {
  const book = new Map<string, GymExercise>();
  const byNorm = new Map(exercises.map((e) => [normPhrase(e.name), e]));
  for (const e of exercises) book.set(normPhrase(e.name), e);
  // Nicknames from the exercise library ("rdl", "pec deck", "skull crushers").
  for (const e of exercises) {
    for (const a of libraryEntry(e.name)?.aliases ?? []) if (!book.has(normPhrase(a))) book.set(normPhrase(a), e);
  }
  for (const [nick, target] of Object.entries(NICKNAMES)) {
    const e = byNorm.get(normPhrase(target));
    if (e && !book.has(normPhrase(nick))) book.set(normPhrase(nick), e);
  }
  return book;
}

// ── Muscles and split days ──────────────────────────────────────────────────
const MUSCLE_WORDS: Record<string, string> = {
  chest: "chest", pec: "chest", pecs: "chest",
  back: "back", lats: "back",
  bicep: "biceps", biceps: "biceps", bi: "biceps", bis: "biceps",
  leg: "legs", legs: "legs", quad: "legs", quads: "legs", hamstring: "legs", hamstrings: "legs", glute: "legs", glutes: "legs",
  shoulder: "shoulders", shoulders: "shoulders", delt: "shoulders", delts: "shoulders",
  tricep: "triceps", triceps: "triceps", tri: "triceps", tris: "triceps",
  abs: "core", core: "core",
  arm: "arms", arms: "arms",
};
/** Which muscle an exercise works most (biceps vs triceps matters for the split). */
export function muscleOf(e: GymExercise): string {
  // Library exercises know their muscle ("Neck curl" is back, not biceps).
  const lib = libraryEntry(e.name);
  if (lib) return lib.muscle === "glutes" ? "legs" : lib.muscle === "forearms" ? "arms" : lib.muscle;
  const n = e.name.toLowerCase();
  if (/leg curl|leg ext|squat|lunge|leg press|calf|romanian|rdl|hip thrust/.test(n)) return "legs";
  if (/curl/.test(n)) return "biceps";
  if (/tricep|skull|pushdown|dip|close grip/.test(n)) return "triceps";
  if (/deadlift/.test(n)) return "back";
  const m = (e.muscle ?? "").toLowerCase();
  if (m === "arms") return "arms";
  if (m === "glutes") return "legs";
  if (m === "forearms") return "arms";
  return m || "other";
}

/** The split day that best fits these muscles ("back" + "biceps" → "Back & Biceps"). */
export function dayForMuscles(muscles: string[], split: string[] = DEFAULT_SPLIT): string | null {
  if (!muscles.length) return null;
  let best: { day: string; score: number } | null = null;
  for (const day of split) {
    const parts = day.toLowerCase().split(/\s*(?:&|and|\+|,|\/)\s*/).map((p) => MUSCLE_WORDS[p.trim()] ?? p.trim());
    const score = muscles.filter((m) => parts.includes(m)).length;
    if (score > 0 && (!best || score > best.score)) best = { day, score };
  }
  return best?.day ?? null;
}

// ── The reader ──────────────────────────────────────────────────────────────
type Tok =
  | { k: "num"; v: number; unit: "lb" | "kg" | null }
  | { k: "x" }
  | { k: "kw"; w: "sets" | "reps" | "at" | "for" | "of" | "each" | "failure" | "bw" }
  | { k: "sep" }
  | { k: "ex"; e: GymExercise; said: string }
  | { k: "word"; w: string };

const SEP_WORDS = new Set(["then", "next", "also", "plus", "and", "after", "followed", "finished", "finally", "lastly", "did", "do", "hit", "went", "played", "ran"]);
const FILLER = new Set(["i", "a", "an", "the", "my", "on", "some", "of", "that", "to", "it", "was", "today", "day", "this", "morning", "tonight", "workout", "gym", "session", "lift", "lifted", "lifting", "then", "just", "like", "um", "uh", "so", "set", "rep", "pound", "lb", "about", "around", "got", "in", "work", "worked", "out", "okay", "ok", "started", "start", "starting", "began", "first", "warm", "warmed", "warmup", "up", "finished", "ended", "felt", "good", "great", "heavy", "light", "easy", "hard", "pretty", "really", "very", "went", "did", "then", "after", "before", "last", "next", "more", "also", "today's", "sesh", "played", "playing", "ran", "for", "hour", "hours", "an"]);

function tokenize(text: string, book: Map<string, GymExercise>): Tok[] {
  const words = gymNumbers(text).split(" ").filter(Boolean);
  const toks: Tok[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    // Exercise names: longest phrase first (up to 6 words).
    let matched = false;
    for (let len = 6; len >= 1; len--) {
      if (i + len > words.length) continue;
      const phrase = normPhrase(words.slice(i, i + len).join(" "));
      const e = book.get(phrase);
      if (e && !/^\d/.test(words[i])) {
        toks.push({ k: "ex", e, said: words.slice(i, i + len).join(" ") });
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (/^\d+(\.\d+)?$/.test(w)) {
      const unitWord = words[i + 1];
      const unit = unitWord && /^(lbs?|pounds?)$/.test(unitWord) ? "lb" : unitWord && /^(kg|kgs|kilos?|kilograms?)$/.test(unitWord) ? "kg" : null;
      toks.push({ k: "num", v: Number(w), unit });
      i += unit ? 2 : 1;
      continue;
    }
    if (w === "x" || w === "by" || w === "times" || w === "×") toks.push({ k: "x" });
    else if (/^sets?$/.test(w) || w === "rounds") toks.push({ k: "kw", w: "sets" });
    else if (/^reps?$/.test(w) || w === "repetitions" || w === "times") toks.push({ k: "kw", w: "reps" });
    else if (w === "at" || w === "@" || w === "using" || w === "with") toks.push({ k: "kw", w: "at" });
    else if (w === "for") toks.push({ k: "kw", w: "for" });
    else if (w === "of") toks.push({ k: "kw", w: "of" });
    else if (w === "each" || w === "apiece") toks.push({ k: "kw", w: "each" });
    else if (w === "failure") toks.push({ k: "kw", w: "failure" });
    else if (w === "bodyweight" || (w === "body" && words[i + 1] === "weight")) {
      toks.push({ k: "kw", w: "bw" });
      if (w === "body") i++;
    } else if (w === ",") toks.push({ k: "sep" });
    else if (SEP_WORDS.has(w)) toks.push({ k: "sep" });
    else toks.push({ k: "word", w });
    i++;
  }
  return toks;
}

/** A run of number-ish tokens → its sets. Returns null if it says nothing. */
type Group = { sets: number | null; reps: number | null; weight: number | null; failure: boolean; bw: boolean; list: number[] | null };

function readGroup(g: Tok[]): Group | null {
  const nums: { v: number; unit: "lb" | "kg" | null; i: number }[] = [];
  g.forEach((t, i) => t.k === "num" && nums.push({ v: t.v, unit: t.unit, i }));
  const has = (w: string) => g.some((t) => t.k === "kw" && t.w === w);
  const failure = has("failure");
  const bw = has("bw");
  if (!nums.length) return failure || bw ? { sets: null, reps: null, weight: null, failure, bw, list: null } : null;
  // "8 7 6": a list of reps, one set each.
  if (nums.length >= 2 && nums.every((n) => !n.unit && n.v <= 50) && !g.some((t) => t.k === "x" || (t.k === "kw" && t.w !== "each" && t.w !== "bw"))) {
    return { sets: null, reps: null, weight: null, failure, bw, list: nums.map((n) => n.v) };
  }

  const kwAfter = (i: number) => {
    for (let j = i + 1; j < g.length; j++) {
      const t = g[j];
      if (t.k === "kw" && (t.w === "sets" || t.w === "reps")) return t.w;
      if (t.k === "num") return null;
    }
    return null;
  };
  const kwBefore = (i: number) => {
    for (let j = i - 1; j >= 0; j--) {
      const t = g[j];
      if (t.k === "kw" && t.w === "at") return "at";
      if (t.k === "kw" && t.w === "for") return "for";
      if (t.k === "kw" && t.w === "of") return g.slice(0, j).some((x) => x.k === "kw" && x.w === "sets") ? "of-sets" : null;
      if (t.k === "kw" && (t.w === "sets" || t.w === "reps")) return null;
      if (t.k === "num" || t.k === "x") return null;
    }
    return null;
  };
  const lbs = (n: { v: number; unit: "lb" | "kg" | null }) => (n.unit === "kg" ? Math.round(n.v * 2.2046) : n.v);

  let sets: number | null = null;
  let reps: number | null = null;
  let weight: number | null = null;
  const used = new Set<number>();

  // Labeled numbers first: "3 sets", "10 reps", "at 135", "135 lb".
  for (const n of nums) {
    const after = kwAfter(n.i);
    if (n.unit) {
      weight = lbs(n);
      used.add(n.i);
    } else if (after === "sets" && sets === null) {
      sets = n.v;
      used.add(n.i);
    } else if (after === "reps" && reps === null) {
      reps = n.v;
      used.add(n.i);
    } else if (kwBefore(n.i) === "at" && weight === null) {
      weight = n.v;
      used.add(n.i);
    } else if (kwBefore(n.i) === "of-sets" && reps === null) {
      reps = n.v; // "3 sets of 10"
      used.add(n.i);
    }
  }

  // A × B (× C).
  const xs = g.map((t, i) => (t.k === "x" ? i : -1)).filter((i) => i >= 0);
  if (xs.length) {
    const around = (xi: number) => {
      const left = nums.filter((n) => n.i < xi && !used.has(n.i)).pop();
      const right = nums.find((n) => n.i > xi && !used.has(n.i));
      return { left, right };
    };
    if (xs.length >= 2) {
      const { left: a, right: b } = around(xs[0]);
      const c = nums.find((n) => n.i > xs[1] && !used.has(n.i));
      if (a && b && c) {
        // 135 x 10 x 3 (weight first) or 3 x 10 x 135 (weight last).
        if (a.v > 20 || a.unit) [weight, reps, sets] = [lbs(a), b.v, c.v];
        else [sets, reps, weight] = [a.v, b.v, lbs(c)];
        [a, b, c].forEach((n) => used.add(n.i));
      }
    } else {
      const { left: a, right: b } = around(xs[0]);
      if (a && b) {
        // 3x10 → sets × reps. 135x10 → weight × reps (one set).
        if ((a.v > 20 || a.unit) && b.v <= 50) {
          weight = lbs(a);
          reps = reps ?? b.v;
        } else {
          sets = sets ?? a.v;
          reps = reps ?? b.v;
        }
        used.add(a.i);
        used.add(b.i);
      }
    }
  }

  // "135 for 10", "10 at 135" without labels.
  const rest = nums.filter((n) => !used.has(n.i));
  for (const n of rest) {
    const before = kwBefore(n.i);
    if (before === "for" && reps === null && n.v <= 100) reps = n.v;
    else if (weight === null && (n.v >= 20 || (reps !== null && sets !== null))) weight = n.v;
    else if (reps === null && n.v <= 100) reps = n.v;
    else if (sets === null && n.v <= 10) sets = n.v;
    else if (weight === null) weight = n.v;
  }
  // "135 for 10" read backwards ("10 for 135") → swap so weight is the bigger one.
  if (weight !== null && reps !== null && sets === null && weight < reps && weight <= 15 && reps >= 20) [weight, reps] = [reps, weight];
  return { sets, reps, weight, failure, bw, list: null };
}

/**
 * Reads a workout sentence. `exercises` is your list (built-in + your own).
 * Unknown exercise names become entries with exerciseId null and the words
 * you said, so nothing is lost.
 */
export function readWorkout(text: string, exercises: GymExercise[], split: string[] = DEFAULT_SPLIT): SpokenWorkout {
  const low = text.toLowerCase();
  const skip = /\b(skip|skipping|skipped|rest day|off day|not going|no gym|missed)\b/.test(low);
  const book = phraseBook(exercises);
  const toks = tokenize(text, book);

  // Muscles said out loud ("chest day", "back and biceps"), not inside an exercise name.
  const saidMuscles = new Set<string>();
  for (const t of toks) if (t.k === "word" && MUSCLE_WORDS[t.w]) saidMuscles.add(MUSCLE_WORDS[t.w]);
  // "push day" / "pull day" / "arm day"
  if (/\bpush day\b/.test(low)) ["chest", "shoulders", "triceps"].forEach((m) => saidMuscles.add(m));
  if (/\bpull day\b/.test(low)) ["back", "biceps"].forEach((m) => saidMuscles.add(m));

  // Group the tokens: exercise mentions, number groups, separators, and unknown words.
  type Item = { kind: "ex"; e: GymExercise | null; said: string } | { kind: "nums"; toks: Tok[] } | { kind: "sep" };
  const items: Item[] = [];
  let unknown: string[] = [];
  const GENERIC = new Set(["press", "raise", "raises", "curl", "curls", "row", "rows", "fly", "flys", "flies", "extension", "extensions", "machine", "dumbbell", "barbell", "cable", "bar", "ez", "smith", "seated", "standing"]);
  const flushUnknown = () => {
    if (items[items.length - 1]?.kind === "ex" && unknown.every((w) => GENERIC.has(w) || FILLER.has(w))) {
      unknown = [];
      return;
    }
    // Words that aren't fillers or muscles, sitting right before numbers, are an exercise we don't know yet.
    const name = unknown.filter((w) => !FILLER.has(w) && !MUSCLE_WORDS[w] && !/^(sets?|reps?)$/.test(w));
    if (name.length) items.push({ kind: "ex", e: null, said: name.join(" ") });
    unknown = [];
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === "word") {
      unknown.push(t.w);
      continue;
    }
    if (t.k === "ex") {
      // "preacher curls": a known word with your own word in front → your own exercise.
      const extra = unknown.filter((w) => !FILLER.has(w) && !MUSCLE_WORDS[w]);
      if (extra.length && extra.length <= 2 && items[items.length - 1]?.kind !== "ex") {
        items.push({ kind: "ex", e: null, said: [...extra, t.said].join(" ") });
        unknown = [];
        continue;
      }
      unknown = [];
      items.push({ kind: "ex", e: t.e, said: t.said });
      continue;
    }
    if (t.k === "sep") {
      unknown = [];
      items.push({ kind: "sep" });
      continue;
    }
    // Number-ish token: unknown words before it name an exercise ("preacher curl 3x10").
    if (unknown.length && (t.k === "num" || t.k === "x")) flushUnknown();
    else if (unknown.length) unknown = [];
    const last = items[items.length - 1];
    if (last && last.kind === "nums") last.toks.push(t);
    else items.push({ kind: "nums", toks: [t] });
  }

  // Attach each number group to an exercise.
  const entries: (SpokenEntry & { key: string })[] = [];
  const entryFor = (e: GymExercise | null, said: string) => {
    const name = e ? e.name : said.charAt(0).toUpperCase() + said.slice(1);
    const key = e ? e.id : `new:${normPhrase(said)}`;
    let found = entries.find((x) => x.key === key);
    if (!found) {
      found = { key, exerciseId: e?.id ?? null, name, sets: [] };
      entries.push(found);
    }
    return found;
  };
  const exAt: (SpokenEntry & { key: string })[] = []; // entry for each "ex" item index
  items.forEach((it, idx) => {
    if (it.kind === "ex") exAt[idx] = entryFor(it.e, it.said);
  });

  const nextEx = (idx: number) => {
    for (let j = idx + 1; j < items.length; j++) {
      if (items[j].kind === "ex") return j;
      if (items[j].kind === "sep") return -1;
    }
    return -1;
  };
  const prevEx = (idx: number) => {
    for (let j = idx - 1; j >= 0; j--) if (items[j].kind === "ex") return j;
    return -1;
  };
  const sepBefore = (idx: number) => idx === 0 || items[idx - 1].kind === "sep";

  // Bits said before the reps arrive ("135 bench 3x10", "three sets of bench at 135 for 10").
  type Partial = { sets: number | null; reps: number | null; weight: number | null };
  const pending = new Map<number, Partial>();
  const push = (entry: SpokenEntry, count: number, weight: number | null, reps: number | null) => {
    for (let n = 0; n < Math.min(count, 20); n++) entry.sets.push({ weightLb: weight, reps });
  };

  items.forEach((it, idx) => {
    if (it.kind !== "nums") return;
    const g = readGroup(it.toks);
    if (!g) return;
    const ahead = nextEx(idx);
    const behind = prevEx(idx);
    // Goes forward when it starts the message or follows a pause and an exercise comes right after.
    const forward = ahead >= 0 && (sepBefore(idx) || behind < 0 || items.slice(behind + 1, idx).some((x) => x.kind === "sep"));
    const target = forward ? ahead : behind >= 0 ? behind : ahead;
    if (target < 0) return;
    const entry = exAt[target];
    const p = pending.get(target) ?? { sets: null, reps: null, weight: null };
    const merged: Partial = { sets: g.sets ?? p.sets, reps: g.reps ?? p.reps, weight: g.weight ?? p.weight };

    // Weight said after the sets on its own ("bench 3x10, 135"): fill in sets missing a weight.
    if (g.sets === null && g.reps === null && !g.list && g.weight !== null && entry.sets.length && entry.sets.every((s) => s.weightLb === null)) {
      entry.sets.forEach((s) => (s.weightLb = g.weight));
      return;
    }
    // A lone number after earlier sets: another set ("135 for 10, 8, 6" or "…, 155 for 8").
    if (g.sets === null && !g.list && entry.sets.length > 0 && !pending.has(target)) {
      const last = entry.sets[entry.sets.length - 1];
      if (g.reps !== null) {
        entry.sets.push({ weightLb: g.weight ?? last.weightLb, reps: g.reps });
        return;
      }
      if (g.weight !== null) {
        entry.sets.push({ weightLb: g.weight, reps: last.reps }); // "…, then 155": same reps, new weight
        return;
      }
    }
    if (g.list) {
      pending.delete(target);
      for (const r of g.list) entry.sets.push({ weightLb: merged.weight, reps: r });
      return;
    }
    // Not enough yet (no reps): wait for the rest of the sentence.
    if (merged.reps === null && !g.failure) {
      pending.set(target, merged);
      return;
    }
    pending.delete(target);
    push(entry, merged.sets ?? 1, merged.weight, g.failure && merged.reps === null ? null : merged.reps);
  });

  // Whatever is still waiting: "did 20 pushups" (reps, for a bodyweight move), "bench 135" (one set).
  for (const [idx, p] of pending) {
    const entry = exAt[idx];
    const it = items[idx];
    const bodyweight = it.kind === "ex" && Boolean(it.e?.bodyweight);
    if (bodyweight && p.reps === null && p.weight !== null) push(entry, p.sets ?? 1, null, p.weight);
    else push(entry, p.sets ?? 1, p.weight, p.reps);
  }

  // Exercises mentioned with no numbers still count (you did them).
  const clean: SpokenEntry[] = entries.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets }));

  // Muscles: what you said, plus what the exercises work.
  const muscles = new Set(saidMuscles);
  for (const e of clean) {
    const ex = exercises.find((x) => x.id === e.exerciseId);
    if (ex) {
      const m = muscleOf(ex);
      if (m !== "other" && m !== "core") muscles.add(m);
    }
  }
  const list = [...muscles];
  // The day: the muscles you named win; otherwise what the exercises worked.
  const day = dayForMuscles([...saidMuscles], split) ?? dayForMuscles(list, split);
  return { entries: clean, muscles: list, day, skip };
}

// ── The standard note ───────────────────────────────────────────────────────
/** "3×10 @ 135 lb" when every set is the same, otherwise "135×10, 155×8, 175×6". */
export function setsSummary(sets: SpokenSet[]): string {
  if (!sets.length) return "done";
  const same = sets.every((s) => s.weightLb === sets[0].weightLb && s.reps === sets[0].reps);
  const r = (n: number | null) => (n === null ? "max" : String(n));
  if (same) {
    const w = sets[0].weightLb;
    return `${sets.length}×${r(sets[0].reps)}${w ? ` @ ${w} lb` : ""}`;
  }
  return sets.map((s) => (s.weightLb ? `${s.weightLb}×${r(s.reps)}` : `BW×${r(s.reps)}`)).join(", ");
}

/** The clean note for a workout, one line per exercise. */
export function workoutNote(w: { day: string | null; entries: SpokenEntry[] }): string {
  const lines = w.entries.map((e) => `• ${e.name}: ${setsSummary(e.sets)}`);
  return [w.day ? `${w.day} day` : "Workout", ...lines].join("\n");
}
