/**
 * Morning Plan and Evening Shutdown: the small bits of logic behind them,
 * kept here so they can be tested without a database.
 *
 * Morning (1 minute): see the day, pick your top 3, one line on what would
 * make today a win. Evening: check off what got done, push the rest to
 * tomorrow, say how the day went.
 */
import { addDays, fromLocal, toLocalDate, zonedParts } from "@/lib/time";

export type PlanTask = { id: string; due_at: string | null; due_has_time: boolean };

/** Which ritual fits right now: plan before noon, shut down from 5 PM. */
export function ritualFor(now: Date, timeZone: string): "morning" | "day" | "evening" {
  const { hour } = zonedParts(now, timeZone);
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 17 || hour < 4) return "evening";
  return "day";
}

/**
 * Tasks worth picking from in the morning, most urgent first: overdue,
 * today, tomorrow, the rest of the week, then things with no day.
 */
export function planCandidates<T extends PlanTask>(open: T[], now: Date, timeZone: string, max = 12): T[] {
  const today = toLocalDate(now, timeZone);
  const weekEnd = addDays(today, 7);
  const rank = (t: T) => {
    if (!t.due_at) return 4;
    const due = new Date(t.due_at);
    const day = toLocalDate(due, timeZone);
    if (due.getTime() < now.getTime() && day <= today) return 0;
    if (day === today) return 1;
    if (day === addDays(today, 1)) return 2;
    if (day <= weekEnd) return 3;
    return 5;
  };
  return open
    .map((t) => ({ t, r: rank(t), at: t.due_at ? new Date(t.due_at).getTime() : Infinity }))
    .filter((x) => x.r < 5)
    .sort((a, b) => a.r - b.r || a.at - b.at)
    .slice(0, max)
    .map((x) => x.t);
}

/** The top 3 pre-picked for you: whatever is overdue or due today, else the next things due. */
export function suggestTop3<T extends PlanTask>(open: T[], now: Date, timeZone: string): string[] {
  return planCandidates(open, now, timeZone, 3).map((t) => t.id);
}

/** Evening: what was meant for today (or is overdue) and is still open. */
export function leftForToday<T extends PlanTask>(open: T[], focusIds: string[], now: Date, timeZone: string): T[] {
  const today = toLocalDate(now, timeZone);
  const focus = new Set(focusIds);
  return open.filter((t) => focus.has(t.id) || (t.due_at && toLocalDate(new Date(t.due_at), timeZone) <= today));
}

/**
 * Moves a due date to tomorrow, keeping the time of day when it has one
 * (a 3 PM quiz moves to 3 PM tomorrow; a plain day becomes tomorrow).
 * Something with no day at all gets tomorrow.
 */
export function tomorrowDue(task: PlanTask, now: Date, timeZone: string): string {
  const tomorrow = addDays(toLocalDate(now, timeZone), 1);
  if (task.due_at && task.due_has_time) {
    const p = zonedParts(new Date(task.due_at), timeZone);
    return fromLocal(tomorrow, { hour: p.hour, minute: p.minute }, timeZone).toISOString();
  }
  return fromLocal(tomorrow, { hour: 23, minute: 59 }, timeZone).toISOString();
}
