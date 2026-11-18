/**
 * Habit math (pure, tested).
 *
 * Strength (0–100): how solid a habit is right now. Recent days count more
 * than old ones (each day back weighs 0.9× the day after it), so one missed
 * day only dips it a little instead of resetting you to zero, and it
 * recovers as you get back on track. A habit you aim to do 3 times a week
 * is at 100 when you do it about 3 times a week.
 *
 * Streak: for daily habits, days in a row (today not done yet doesn't break
 * it). For "X times a week", weeks in a row where you hit the target.
 */
import { addDays, weekdayOf, type LocalDate } from "@/lib/time";

export type HabitTarget = { times: number; per: "day" | "week" };

const DECAY = 0.9;
const WINDOW = 60;

/** Expected check-ins per day for a target: daily = 1, 3×/week ≈ 0.43. */
export function perDay(t: HabitTarget): number {
  return t.per === "day" ? Math.min(1, t.times) : Math.min(7, t.times) / 7;
}

export function strength(checkins: Set<LocalDate>, target: HabitTarget, today: LocalDate, startedOn: LocalDate): number {
  const expected = perDay(target);
  let done = 0;
  let possible = 0;
  for (let i = 0; i < WINDOW; i++) {
    const day = addDays(today, -i);
    if (day < startedOn) break;
    const w = DECAY ** i;
    // Today only counts once you've done it (the day isn't over yet).
    if (i === 0 && !checkins.has(day)) continue;
    done += w * (checkins.has(day) ? 1 : 0);
    possible += w * expected;
  }
  if (possible === 0) return checkins.has(today) ? 100 : 0;
  return Math.round(Math.min(1, done / possible) * 100);
}

/** Monday of the week containing `date`. */
function weekOf(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function streak(checkins: Set<LocalDate>, target: HabitTarget, today: LocalDate): number {
  if (target.per === "day") {
    let n = 0;
    let day = checkins.has(today) ? today : addDays(today, -1);
    while (checkins.has(day)) {
      n++;
      day = addDays(day, -1);
    }
    return n;
  }
  // Weekly: count back full weeks that hit the target; this week counts once it's hit.
  const countIn = (monday: LocalDate) => {
    let c = 0;
    for (let i = 0; i < 7; i++) if (checkins.has(addDays(monday, i))) c++;
    return c;
  };
  let n = 0;
  let monday = weekOf(today);
  if (countIn(monday) >= target.times) n++;
  monday = addDays(monday, -7);
  while (countIn(monday) >= target.times) {
    n++;
    monday = addDays(monday, -7);
  }
  return n;
}

/** Check-ins so far this week (for "2/3 this week"). */
export function thisWeek(checkins: Set<LocalDate>, today: LocalDate): number {
  const monday = weekOf(today);
  let c = 0;
  for (let i = 0; i < 7; i++) if (checkins.has(addDays(monday, i))) c++;
  return c;
}

/** "Every day", "3× a week". */
export function describeTarget(t: HabitTarget): string {
  if (t.per === "day") return t.times === 1 ? "Every day" : `${t.times}× a day`;
  return t.times === 7 ? "Every day" : `${t.times}× a week`;
}
