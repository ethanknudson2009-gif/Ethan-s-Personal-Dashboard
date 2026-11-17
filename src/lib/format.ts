/**
 * Turning dates and times into words people read: "Fri, Nov 13 · 11:59 PM",
 * "Tomorrow", "8:00 AM". Pure functions, tested in format.test.ts.
 */
import { addDays, daysBetween, toLocalDate, weekdayOf, zonedParts, type LocalDate } from "@/lib/time";

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 14, 5 → "2:05 PM". */
export function formatClock(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** Database time "08:00:00" → "8:00 AM". */
export function formatTimeOfDay(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return formatClock(h, m);
}

/** "2026-11-13" → "Fri, Nov 13". */
export function formatLocalDate(date: LocalDate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(date)]}, ${MONTH_SHORT[m - 1]} ${d}`;
}

/**
 * A deadline in words, relative to now:
 * "Today · 11:59 PM", "Tomorrow", "Fri, Nov 13 · 3:00 PM", "Overdue · Mon, Nov 9".
 */
export function formatDue(dueAt: Date, hasTime: boolean, now: Date, timeZone: string): string {
  const today = toLocalDate(now, timeZone);
  const day = toLocalDate(dueAt, timeZone);
  const p = zonedParts(dueAt, timeZone);
  const time = hasTime ? ` · ${formatClock(p.hour, p.minute)}` : "";
  const overdue = dueAt.getTime() < now.getTime();

  let dayText: string;
  if (day === today) dayText = "Today";
  else if (day === addDays(today, 1)) dayText = "Tomorrow";
  else if (day === addDays(today, -1)) dayText = "Yesterday";
  else dayText = formatLocalDate(day);

  return overdue && day !== today ? `Overdue · ${dayText}${time}` : `${dayText}${time}`;
}

/** Whole days from today until the deadline (0 = today, negative = overdue). */
export function daysUntil(dueAt: Date, now: Date, timeZone: string): number {
  return daysBetween(toLocalDate(now, timeZone), toLocalDate(dueAt, timeZone));
}

/** "Speech: “What is Equal” Journal" — the class-first title format from doc 08. */
export function taskDisplayTitle(title: string, className: string | null): string {
  return className ? `${className}: ${title}` : title;
}
