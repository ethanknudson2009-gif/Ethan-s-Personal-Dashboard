/**
 * Calendar date math (pure, tested): weeks start on Monday, months are shown
 * as a 6-row grid of whole weeks.
 */
import { addDays, parseLocalDate, weekdayOf, type LocalDate } from "@/lib/time";

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The Monday on or before `date`. */
export function weekStart(date: LocalDate): LocalDate {
  const wd = weekdayOf(date); // 0 = Sunday
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

/** The 7 days (Mon–Sun) of the week containing `date`. */
export function weekDays(date: LocalDate): LocalDate[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 42 days (6 weeks, Monday first) covering the month of `date`. */
export function monthGrid(date: LocalDate): { date: LocalDate; inMonth: boolean }[] {
  const { year, month } = parseLocalDate(date);
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = addDays(start, i);
    return { date: d, inMonth: parseLocalDate(d).month === month };
  });
}

/** "November 2026". */
export function monthTitle(date: LocalDate): string {
  const { year, month } = parseLocalDate(date);
  return `${MONTH_LONG[month - 1]} ${year}`;
}

/** Same day-of-month in the next/previous month (clamped), for the Month view arrows. */
export function shiftMonth(date: LocalDate, months: number): LocalDate {
  const { year, month } = parseLocalDate(date);
  const idx = month - 1 + months;
  const y = year + Math.floor(idx / 12);
  const m = ((idx % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** A safe YYYY-MM-DD from the address bar, or the fallback. */
export function safeDate(value: unknown, fallback: LocalDate): LocalDate {
  if (typeof value !== "string") return fallback;
  try {
    parseLocalDate(value);
    return value;
  } catch {
    return fallback;
  }
}
