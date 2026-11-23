/**
 * "Start Chest day" → the whole workout ready to go, so logging is just
 * tapping ✓. Pure and tested (gym-plan.test.ts).
 *
 * - Done this split day before? The same exercises in the same order, with
 *   last time's weights and reps filled in.
 * - First time? A starter set of exercises for the day's muscles (from the
 *   exercise library), with your last weights if you've done them before.
 */
import { lastTime, type GymSet } from "./gym";
import { plain } from "./exercise-library";

export type PastSession = { day: string | null; skipped: boolean; sets: GymSet[] };
export type PlannedSet = { exerciseId: string; weightLb: number | null; reps: number | null };

/** Starter exercises per muscle group (library names), most important first. */
export const STARTERS: Record<string, string[]> = {
  chest: ["Bench press", "Incline dumbbell press", "Chest fly", "Push-ups"],
  back: ["Lat pulldown", "Barbell row", "Seated cable row", "Face pull"],
  biceps: ["Bicep curl", "Hammer curl"],
  triceps: ["Tricep pushdown", "Overhead cable extension", "Skull crushers"],
  legs: ["Squat", "Leg press", "Romanian deadlift", "Leg extension", "Leg curl", "Calf raise"],
  glutes: ["Hip thrust", "Bulgarian split squat"],
  shoulders: ["Dumbbell shoulder press", "Lateral raise", "Rear delt fly"],
  arms: ["Bicep curl", "Tricep pushdown", "Hammer curl", "Skull crushers"],
  core: ["Hanging leg raise", "Cable crunch", "Plank (seconds)"],
  push: ["Bench press", "Incline dumbbell press", "Dumbbell shoulder press", "Lateral raise", "Tricep pushdown"],
  pull: ["Lat pulldown", "Barbell row", "Face pull", "Bicep curl", "Hammer curl"],
  "upper body": ["Bench press", "Barbell row", "Dumbbell shoulder press", "Lat pulldown", "Bicep curl", "Tricep pushdown"],
  "lower body": ["Squat", "Romanian deadlift", "Leg press", "Leg curl", "Calf raise"],
  "full body": ["Squat", "Bench press", "Barbell row", "Dumbbell shoulder press", "Romanian deadlift"],
};

const WORDS: Record<string, string> = {
  chest: "chest", pec: "chest", pecs: "chest",
  back: "back", lats: "back",
  bicep: "biceps", biceps: "biceps", bi: "biceps", bis: "biceps",
  tricep: "triceps", triceps: "triceps", tri: "triceps", tris: "triceps",
  leg: "legs", legs: "legs", quads: "legs", hamstrings: "legs",
  glute: "glutes", glutes: "glutes", booty: "glutes",
  shoulder: "shoulders", shoulders: "shoulders", delts: "shoulders",
  arm: "arms", arms: "arms",
  abs: "core", core: "core",
  push: "push", pull: "pull", upper: "upper body", lower: "lower body", full: "full body",
};

/** "Back & Biceps" → ["back", "biceps"]; "Push" → ["push"]. */
export function musclesOfDay(day: string): string[] {
  const out: string[] = [];
  for (const w of plain(day).split(" ")) {
    const m = WORDS[w];
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

/** The workout to start for this split day. */
export function planForDay(
  day: string,
  history: PastSession[],
  exercises: { id: string; name: string }[],
): { from: "last time" | "starter" | "empty"; sets: PlannedSet[] } {
  // 1) The last time you trained this day (newest first in `history`).
  const last = history.find((w) => !w.skipped && w.day === day && w.sets.some((s) => s.done !== false));
  if (last) {
    const sets = last.sets.filter((s) => s.done !== false).map((s) => ({ exerciseId: s.exerciseId, weightLb: s.weightLb, reps: s.reps }));
    return { from: "last time", sets };
  }
  // 2) Starter exercises for the day's muscles.
  const byName = new Map(exercises.map((e) => [plain(e.name), e.id]));
  const ids: string[] = [];
  for (const m of musclesOfDay(day)) {
    for (const name of STARTERS[m] ?? []) {
      const id = byName.get(plain(name));
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  if (!ids.length) return { from: "empty", sets: [] };
  const byWorkout = history.filter((w) => !w.skipped).map((w) => w.sets);
  const sets = ids.flatMap((id) => {
    const prev = lastTime(id, byWorkout);
    return prev.length
      ? prev.map((s) => ({ exerciseId: id, weightLb: s.weightLb, reps: s.reps }))
      : [0, 1, 2].map(() => ({ exerciseId: id, weightLb: null, reps: null }));
  });
  return { from: "starter", sets };
}
