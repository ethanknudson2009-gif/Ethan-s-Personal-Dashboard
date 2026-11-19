/**
 * Gym math (pure, tested): estimated one-rep max, personal records, volume,
 * and what to pre-fill from last time.
 */

export type GymSet = { exerciseId: string; weightLb: number | null; reps: number | null; done?: boolean };

/**
 * Estimated 1-rep max (Epley formula: weight × (1 + reps/30)). One rep = the
 * weight itself. Used to compare sets with different reps fairly.
 */
export function oneRepMax(weightLb: number, reps: number): number {
  if (weightLb <= 0 || reps <= 0) return 0;
  return reps === 1 ? weightLb : Math.round(weightLb * (1 + reps / 30));
}

/** Total pounds moved (weight × reps) for finished sets. */
export function volume(sets: GymSet[]): number {
  return sets.reduce((sum, s) => sum + (s.done !== false && s.weightLb && s.reps ? s.weightLb * s.reps : 0), 0);
}

/** Best estimated 1RM per exercise. */
export function bestByExercise(sets: GymSet[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.done === false || !s.weightLb || !s.reps) continue;
    const e = oneRepMax(s.weightLb, s.reps);
    if (e > (best.get(s.exerciseId) ?? 0)) best.set(s.exerciseId, e);
  }
  return best;
}

/** Exercises where today's best beats every earlier workout: new personal records. */
export function newRecords(today: GymSet[], history: GymSet[]): { exerciseId: string; e1rm: number; previous: number }[] {
  const before = bestByExercise(history);
  const now = bestByExercise(today);
  const out: { exerciseId: string; e1rm: number; previous: number }[] = [];
  for (const [id, e] of now) {
    const prev = before.get(id) ?? 0;
    if (prev > 0 && e > prev) out.push({ exerciseId: id, e1rm: e, previous: prev });
  }
  return out;
}

/** The sets from the last time you did this exercise, to pre-fill today's (newest workout first in `history`). */
export function lastTime(exerciseId: string, historyByWorkout: GymSet[][]): GymSet[] {
  for (const w of historyByWorkout) {
    const sets = w.filter((s) => s.exerciseId === exerciseId && s.done !== false && s.reps);
    if (sets.length) return sets;
  }
  return [];
}

/** "135 × 10" / "Bodyweight × 12". */
export function setLabel(s: { weightLb: number | null; reps: number | null }): string {
  return `${s.weightLb ? s.weightLb : "BW"} × ${s.reps ?? "?"}`;
}

/** Everyday names for the built-in exercises ("bench" → "Bench press"). */
const ALIASES: Record<string, string> = {
  bench: "bench press",
  "bench pres": "bench press",
  "incline bench": "incline dumbbell press",
  "incline pres": "incline dumbbell press",
  pushup: "push-up",
  "push up": "push-up",
  fly: "chest fly",
  flie: "chest fly",
  rdl: "romanian deadlift",
  lunge: "lunge",
  "hamstring curl": "leg curl",
  calve: "calf raise",
  calf: "calf raise",
  dead: "deadlift",
  "dead lift": "deadlift",
  pullup: "pull-up",
  "pull up": "pull-up",
  chinup: "pull-up",
  "chin up": "pull-up",
  pulldown: "lat pulldown",
  "lat pull": "lat pulldown",
  row: "barbell row",
  "cable row": "seated cable row",
  ohp: "overhead press",
  "shoulder pres": "overhead press",
  "military pres": "overhead press",
  "side raise": "lateral raise",
  "lat raise": "lateral raise",
  curl: "bicep curl",
  "bicep curl": "bicep curl",
  "hammer curl": "hammer curl",
  pushdown: "tricep pushdown",
  "tricep extension": "tricep pushdown",
  "skull crusher": "skull crusher",
  dip: "dip",
  plank: "plank (second)",
  crunch: "crunch",
  situp: "crunch",
  "sit up": "crunch",
  "leg raise": "hanging leg raise",
};

/** Lowercase, words only, simple singular ("squats" → "squat", "presses" → "pres"). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length >= 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ");
}

/**
 * Which exercise a spoken name means: exact name, then a nickname, then the
 * closest name that contains every word you said. Null if unsure.
 */
export function matchExercise<T extends { id: string; name: string }>(said: string, exercises: T[]): T | null {
  const q = norm(said);
  if (!q) return null;
  const byNorm = new Map(exercises.map((e) => [norm(e.name), e]));
  const exact = byNorm.get(q) ?? byNorm.get(norm(ALIASES[q] ?? ""));
  if (exact) return exact;
  const words = q.split(" ");
  const candidates = exercises
    .map((e) => ({ e, n: norm(e.name).split(" ") }))
    .filter(({ n }) => words.every((w) => n.includes(w)))
    .sort((a, b) => a.n.length - b.n.length);
  return candidates[0]?.e ?? null;
}

/** Where the rotation goes after you train `day`: the day after it (wrapping around). Unknown day → no change. */
export function nextAfter(split: string[], day: string | null, current: number): number {
  if (!split.length) return 0;
  const i = day ? split.findIndex((d) => d.toLowerCase() === day.toLowerCase()) : -1;
  return i < 0 ? current % split.length : (i + 1) % split.length;
}
