/**
 * Window-washing business math (pure, tested): who's due for another wash,
 * and what the month earned.
 */
import { addDays, daysBetween, type LocalDate } from "@/lib/time";

export type JobStatus = "scheduled" | "done" | "paid";

export type WashState =
  | { kind: "new" } // never washed yet
  | { kind: "scheduled"; on: LocalDate }
  | { kind: "due"; since: LocalDate; daysOver: number }
  | { kind: "ok"; next: LocalDate; inDays: number }
  | { kind: "one-time" };

/**
 * Where a customer stands. `repeatWeeks` = how often they want a wash
 * (null = one-time customer). A job already on the calendar wins.
 */
export function washState(
  customer: { repeatWeeks: number | null },
  lastWashed: LocalDate | null,
  nextScheduled: LocalDate | null,
  today: LocalDate,
): WashState {
  if (nextScheduled) return { kind: "scheduled", on: nextScheduled };
  if (!lastWashed) return { kind: "new" };
  if (!customer.repeatWeeks) return { kind: "one-time" };
  const next = addDays(lastWashed, customer.repeatWeeks * 7);
  const inDays = daysBetween(today, next);
  return inDays <= 0 ? { kind: "due", since: next, daysOver: -inDays } : { kind: "ok", next, inDays };
}

export type JobRow = { status: JobStatus; priceCents: number; date: LocalDate };

/** Earned (paid) this month, still owed (done but not paid), and booked (scheduled). */
export function jobTotals(jobs: JobRow[], monthKey: string) {
  let paidCents = 0;
  let owedCents = 0;
  let bookedCents = 0;
  let jobsDone = 0;
  for (const j of jobs) {
    if (j.status === "paid" && j.date.startsWith(monthKey)) {
      paidCents += j.priceCents;
      jobsDone++;
    }
    if (j.status === "done") owedCents += j.priceCents;
    if (j.status === "scheduled") bookedCents += j.priceCents;
  }
  return { paidCents, owedCents, bookedCents, jobsDone };
}
