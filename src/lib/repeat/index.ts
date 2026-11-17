/**
 * Repeating tasks. See docs/07-architecture.md §9.2.
 *
 * Two modes:
 *  - "fixed": follows the calendar ("every Monday"). If you finish late,
 *    the next one is the next calendar slot after you finished, so you never
 *    get a pile of already-overdue copies.
 *  - "after_completion": counts from when you actually finished
 *    ("water plants 7 days after I last did it").
 *
 * The next task keeps the same time of day (in your time zone) as the last one.
 */
import {
  addDays,
  compareLocalDates,
  fromLocal,
  parseLocalDate,
  toLocalDate,
  weekdayOf,
  zonedParts,
  type LocalDate,
} from "@/lib/time";

export type RepeatRule = {
  mode: "fixed" | "after_completion";
  every: number;
  unit: "day" | "week" | "month";
  /** Only for fixed weekly rules: which weekdays (0 = Sunday … 6 = Saturday). */
  weekdays?: number[];
  /** Last date a repeat may fall on. */
  until?: LocalDate;
};

/** Adds whole months, landing on the last day of a shorter month (Jan 31 + 1 → Feb 28). */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const targetMonthIndex = month - 1 + months;
  const y = year + Math.floor(targetMonthIndex / 12);
  const m = ((targetMonthIndex % 12) + 12) % 12; // 0–11
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** One step forward from `date` by the rule's interval. */
function step(date: LocalDate, rule: RepeatRule): LocalDate {
  const every = Math.max(1, Math.floor(rule.every));
  if (rule.unit === "day") return addDays(date, every);
  if (rule.unit === "month") return addMonths(date, every);

  // Weekly. With specific weekdays, go to the next listed weekday in the same
  // week; after the last one, jump `every` weeks ahead to the first one.
  const days = [...new Set(rule.weekdays ?? [])].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) return addDays(date, 7 * every);

  const wd = weekdayOf(date);
  const laterThisWeek = days.find((d) => d > wd);
  if (laterThisWeek !== undefined) return addDays(date, laterThisWeek - wd);
  const startOfWeek = addDays(date, -wd); // Sunday
  return addDays(startOfWeek, 7 * every + days[0]);
}

/**
 * When the next copy of a repeating task is due, or null if the rule has ended.
 * @param previousDue  the due time of the task you just finished
 * @param completedAt  when you marked it done
 */
export function nextDue(
  rule: RepeatRule,
  previousDue: Date,
  completedAt: Date,
  timeZone: string,
): Date | null {
  const due = zonedParts(previousDue, timeZone);
  const time = { hour: due.hour, minute: due.minute };

  let date: LocalDate;
  if (rule.mode === "after_completion") {
    date = step(toLocalDate(completedAt, timeZone), rule);
  } else {
    date = step(toLocalDate(previousDue, timeZone), rule);
    // Finished late? Skip calendar slots that are already in the past.
    for (let guard = 0; guard < 1000 && fromLocal(date, time, timeZone) <= completedAt; guard++) {
      date = step(date, rule);
    }
  }

  if (rule.until && compareLocalDates(date, rule.until) > 0) return null;
  return fromLocal(date, time, timeZone);
}
