/**
 * Numbers for the Stats page (pure, tested in stats.test.ts). Everything
 * works on local dates ("2026-11-23") and weeks that start on Monday.
 */
import { addDays, weekdayOf, type LocalDate } from "@/lib/time";

/** The Monday of the week a date falls in. */
export function mondayOf(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

/** The last `count` week starts (Mondays), oldest first, ending with this week. */
export function lastWeeks(today: LocalDate, count: number): LocalDate[] {
  const monday = mondayOf(today);
  return Array.from({ length: count }, (_, i) => addDays(monday, (i - count + 1) * 7));
}

/** The last `count` days, oldest first, ending today. */
export function lastDays(today: LocalDate, count: number): LocalDate[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
}

/** Adds up `value` per week for each week start in `weeks` (dates outside are ignored). */
export function sumByWeek<T>(rows: T[], dateOf: (r: T) => LocalDate | null, valueOf: (r: T) => number, weeks: LocalDate[]): number[] {
  const index = new Map(weeks.map((w, i) => [w, i]));
  const out = weeks.map(() => 0);
  for (const r of rows) {
    const d = dateOf(r);
    if (!d) continue;
    const i = index.get(mondayOf(d));
    if (i !== undefined) out[i] += valueOf(r);
  }
  return out;
}

/** Adds up `value` per day for each day in `days`. */
export function sumByDay<T>(rows: T[], dateOf: (r: T) => LocalDate | null, valueOf: (r: T) => number, days: LocalDate[]): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = days.map(() => 0);
  for (const r of rows) {
    const d = dateOf(r);
    const i = d ? index.get(d) : undefined;
    if (i !== undefined) out[i] += valueOf(r);
  }
  return out;
}

/** This week vs last week: the change, and whether going up is good. */
export type Delta = { now: number; before: number; change: number; percent: number | null };
export function delta(now: number, before: number): Delta {
  return { now, before, change: now - before, percent: before ? Math.round(((now - before) / before) * 100) : null };
}

/** How many of the last `days` days a habit was checked in (only days since it started). */
export function habitRate(checkins: Set<LocalDate>, today: LocalDate, days: number, startedOn: LocalDate): { hit: number; of: number } {
  let hit = 0;
  let of = 0;
  for (const d of lastDays(today, days)) {
    if (d < startedOn) continue;
    of++;
    if (checkins.has(d)) hit++;
  }
  return { hit, of };
}

/** Pounds moved: weight × reps over finished sets (bodyweight sets count 0). */
export function volume(sets: { weightLb: number | null; reps: number | null; done: boolean }[]): number {
  return sets.reduce((n, s) => n + (s.done && s.weightLb && s.reps ? s.weightLb * s.reps : 0), 0);
}

/** Best (heaviest) finished set per exercise, heaviest first. Ties go to more reps, then the earliest day. */
export function bestLifts(
  sets: { exercise: string; weightLb: number | null; reps: number | null; done: boolean; day: LocalDate }[],
  limit = 6,
): { exercise: string; weightLb: number; reps: number; day: LocalDate }[] {
  const best = new Map<string, { exercise: string; weightLb: number; reps: number; day: LocalDate }>();
  for (const s of sets) {
    if (!s.done || !s.weightLb || !s.reps) continue;
    const cur = best.get(s.exercise);
    const better =
      !cur || s.weightLb > cur.weightLb || (s.weightLb === cur.weightLb && (s.reps > cur.reps || (s.reps === cur.reps && s.day < cur.day)));
    if (better) best.set(s.exercise, { exercise: s.exercise, weightLb: s.weightLb, reps: s.reps, day: s.day });
  }
  return [...best.values()].sort((a, b) => b.weightLb - a.weightLb).slice(0, limit);
}

/** "Nov 17" for a week start. */
export function shortDate(date: LocalDate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}`;
}

/** 12_400 → "12.4k", 950 → "950". */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

/** Share of finished tasks that were done by their due date (tasks with no due date are left out). */
export function onTimeRate(tasks: { completedAt: string | null; dueAt: string | null }[]): { onTime: number; of: number } {
  let onTime = 0;
  let of = 0;
  for (const t of tasks) {
    if (!t.completedAt || !t.dueAt) continue;
    of++;
    if (new Date(t.completedAt).getTime() <= new Date(t.dueAt).getTime()) onTime++;
  }
  return { onTime, of };
}

/** The weekday (0 = Sunday) with the most entries, or null if there are none. */
export function busiestWeekday(dates: LocalDate[]): number | null {
  const count = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) count[weekdayOf(d)]++;
  const max = Math.max(...count);
  return max ? count.indexOf(max) : null;
}

/** Weeks in a row (counting back from this week) with at least one entry. This week can still be empty. */
export function weeksInARow(perWeek: number[]): number {
  let n = 0;
  for (let i = perWeek.length - 1; i >= 0; i--) {
    if (perWeek[i] > 0) n++;
    else if (i !== perWeek.length - 1) break;
  }
  return n;
}

/** The most common item and how many times it shows up. */
export function mostCommon(items: string[]): { item: string; count: number } | null {
  const count = new Map<string, number>();
  for (const it of items) count.set(it, (count.get(it) ?? 0) + 1);
  let best: { item: string; count: number } | null = null;
  for (const [item, n] of count) if (!best || n > best.count) best = { item, count: n };
  return best;
}
