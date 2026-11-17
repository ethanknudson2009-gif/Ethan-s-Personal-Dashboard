/**
 * Time-zone-aware helpers.
 *
 * The server runs in UTC, but "today", "Friday" and "11:59pm" all mean
 * Ethan's local time (America/Phoenix by default). Every piece of date logic
 * in the app goes through these helpers so we never accidentally use the
 * server's clock zone. See docs/07-architecture.md §3.
 *
 * Two kinds of values:
 *  - an *instant* is a JavaScript Date (a moment in time, stored as UTC)
 *  - a *local date* is a "YYYY-MM-DD" string (a calendar day, no zone)
 */
import { TZDate } from "@date-fns/tz";

export const DEFAULT_TIME_ZONE = "America/Phoenix";

/** A calendar day written as "YYYY-MM-DD". */
export type LocalDate = string;

/** Hours and minutes on a wall clock, e.g. { hour: 23, minute: 59 }. */
export type LocalTime = { hour: number; minute: number };

export type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  weekday: number; // 0 = Sunday … 6 = Saturday
  hour: number; // 0–23
  minute: number;
};

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** What a wall clock in `timeZone` shows at `instant`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const z = new TZDate(instant.getTime(), timeZone);
  return {
    year: z.getFullYear(),
    month: z.getMonth() + 1,
    day: z.getDate(),
    weekday: z.getDay(),
    hour: z.getHours(),
    minute: z.getMinutes(),
  };
}

/** The local calendar day of `instant` in `timeZone`, e.g. "2026-11-10". */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const p = zonedParts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Split "YYYY-MM-DD" into numbers. Throws on anything else. */
export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: "${date}"`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Round-trip through UTC to reject impossible dates like 2026-02-30.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error(`Impossible date: "${date}"`);
  }
  return { year, month, day };
}

/**
 * The instant when a wall clock in `timeZone` shows `date` at `time`.
 * Example: fromLocal("2026-11-13", {hour: 23, minute: 59}, "America/Phoenix")
 *          → 2026-11-14T06:59:00.000Z
 */
export function fromLocal(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const z = new TZDate(year, month - 1, day, time.hour, time.minute, 0, timeZone);
  return new Date(z.getTime());
}

/** First instant of a local day (00:00). */
export function startOfLocalDay(date: LocalDate, timeZone: string): Date {
  return fromLocal(date, { hour: 0, minute: 0 }, timeZone);
}

/** Pure calendar math: "2026-11-30" + 1 → "2026-12-01". No time zone involved. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Day of the week for a local date: 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  const ms = Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day);
  return Math.round(ms / 86_400_000);
}

/** Compare two local dates as strings work for YYYY-MM-DD: negative, 0 or positive. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
