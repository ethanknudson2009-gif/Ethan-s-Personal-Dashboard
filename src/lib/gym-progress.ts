/**
 * Gym progress (pure, tested): the numbers behind the charts on /gym.
 *  - strength over time for one exercise (best estimated 1-rep max per workout)
 *  - pounds moved per week
 *  - how often each split day was trained lately
 */
import { oneRepMax, volume, type GymSet } from "@/lib/gym";
import { addDays, weekdayOf, type LocalDate } from "@/lib/time";

export type PastWorkout = { date: LocalDate; day: string | null; skipped: boolean; sets: GymSet[] };
export type StrengthPoint = { date: LocalDate; e1rm: number; weightLb: number; reps: number };
export type WeekPoint = { weekStart: LocalDate; volume: number; workouts: number };

/** Best set (by estimated 1-rep max) of one exercise in each workout, oldest first. */
export function strengthSeries(workouts: PastWorkout[], exerciseId: string): StrengthPoint[] {
  const out: StrengthPoint[] = [];
  for (const w of workouts) {
    let best: StrengthPoint | null = null;
    for (const s of w.sets) {
      if (s.exerciseId !== exerciseId || s.done === false || !s.weightLb || !s.reps) continue;
      const e = oneRepMax(s.weightLb, s.reps);
      if (!best || e > best.e1rm) best = { date: w.date, e1rm: e, weightLb: s.weightLb, reps: s.reps };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Monday of the week a date falls in. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Pounds moved and workouts per week, for the last `weeks` weeks (oldest first, empty weeks included). */
export function weeklyVolume(workouts: PastWorkout[], today: LocalDate, weeks = 8): WeekPoint[] {
  const thisWeek = weekStart(today);
  const out: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push({ weekStart: addDays(thisWeek, -7 * i), volume: 0, workouts: 0 });
  for (const w of workouts) {
    if (w.skipped) continue;
    const slot = out.find((p) => p.weekStart === weekStart(w.date));
    if (!slot) continue;
    slot.volume += volume(w.sets);
    slot.workouts += 1;
  }
  return out;
}

/** How many times each split day was trained (not skipped) since a date, in split order. */
export function splitCounts(workouts: PastWorkout[], split: string[], since: LocalDate): { day: string; count: number; skipped: number }[] {
  return split.map((day) => ({
    day,
    count: workouts.filter((w) => w.day === day && !w.skipped && w.date >= since).length,
    skipped: workouts.filter((w) => w.day === day && w.skipped && w.date >= since).length,
  }));
}

/** Exercises with at least `min` workouts of data, most trained first (for the chart picker). */
export function chartableExercises(workouts: PastWorkout[], min = 1): { exerciseId: string; sessions: number }[] {
  const count = new Map<string, number>();
  for (const w of workouts) {
    const ids = new Set(w.sets.filter((s) => s.done !== false && s.weightLb && s.reps).map((s) => s.exerciseId));
    for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
  }
  return [...count.entries()]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([exerciseId, sessions]) => ({ exerciseId, sessions }));
}
