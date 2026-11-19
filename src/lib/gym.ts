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
