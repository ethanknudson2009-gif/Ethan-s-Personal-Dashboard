/**
 * School schedule logic: which days are school days, and for rotating
 * schedules (A/B days, block schedules, 6-day cycles) which day label
 * each date gets. See docs/07-architecture.md §9.3.
 *
 * Key idea: only SCHOOL days move the rotation forward. A holiday on what
 * would have been a B day doesn't skip B; the next school day is B.
 */
import { addDays, compareLocalDates, weekdayOf, type LocalDate } from "@/lib/time";

export type Term = { startsOn: LocalDate; endsOn: LocalDate };

export type Schedule = {
  kind: "weekly" | "rotating";
  /** Weekdays with school: 0 = Sunday … 6 = Saturday. Ethan: [1, 2, 3, 4] (Mon–Thu). */
  schoolWeekdays: number[];
  /** Rotation labels in order, e.g. ["A", "B"]. Ignored for weekly schedules. */
  dayLabels: string[];
  /** A school day whose label you know, e.g. "2026-11-09" was an "A" day. */
  anchorDate: LocalDate;
  anchorLabel: string;
};

/**
 * A one-day exception. `noSchool` cancels school that day. `label` forces a
 * label for that day only; it does not shift the rest of the rotation.
 * (To shift the whole rotation, change the anchor instead.)
 */
export type Override = { date: LocalDate; noSchool?: boolean; label?: string };

export type ScheduleContext = {
  term: Term;
  schedule: Schedule;
  noSchoolDays: LocalDate[];
  overrides?: Override[];
};

export type DayInfo = { isSchoolDay: boolean; label: string | null };

export type ClassMeeting = {
  classId: string;
  /** For weekly schedules: the weekday this meeting happens. */
  weekday?: number | null;
  /** For rotating schedules: the day label this meeting happens on. */
  dayLabel?: string | null;
  startsAt: string; // "HH:MM"
  endsAt: string; // "HH:MM"
};

function inTerm(date: LocalDate, term: Term) {
  return compareLocalDates(date, term.startsOn) >= 0 && compareLocalDates(date, term.endsOn) <= 0;
}

/** Is `date` a regular school day, ignoring overrides? (Used for counting the rotation.) */
function isRegularSchoolDay(date: LocalDate, ctx: ScheduleContext, noSchool: Set<LocalDate>): boolean {
  if (!inTerm(date, ctx.term)) return false;
  if (!ctx.schedule.schoolWeekdays.includes(weekdayOf(date))) return false;
  if (noSchool.has(date)) return false;
  return true;
}

/** Set of all no-school dates, including "noSchool" overrides. */
function noSchoolSet(ctx: ScheduleContext): Set<LocalDate> {
  const set = new Set(ctx.noSchoolDays);
  for (const o of ctx.overrides ?? []) if (o.noSchool) set.add(o.date);
  return set;
}

/**
 * Number of school days from the anchor to `date`.
 * Positive when `date` is after the anchor, negative when before, 0 on the anchor.
 */
export function schoolDaysFromAnchor(date: LocalDate, ctx: ScheduleContext): number {
  const noSchool = noSchoolSet(ctx);
  const anchor = ctx.schedule.anchorDate;
  const direction = compareLocalDates(date, anchor);
  if (direction === 0) return 0;

  let count = 0;
  const step = direction > 0 ? 1 : -1;
  // Walk from the anchor toward `date`, counting school days we land on.
  // The anchor itself isn't counted; `date` is counted if it's a school day.
  for (let d = addDays(anchor, step); ; d = addDays(d, step)) {
    if (isRegularSchoolDay(d, ctx, noSchool)) count += step;
    if (d === date) break;
  }
  return count;
}

/** Whether `date` is a school day and, for rotating schedules, its label. */
export function dayInfo(date: LocalDate, ctx: ScheduleContext): DayInfo {
  const override = (ctx.overrides ?? []).find((o) => o.date === date);
  if (override?.noSchool) return { isSchoolDay: false, label: null };

  const noSchool = noSchoolSet(ctx);
  const regular = isRegularSchoolDay(date, ctx, noSchool);

  // A forced label makes that day a school day (e.g. a make-up Friday).
  if (override?.label) return { isSchoolDay: inTerm(date, ctx.term), label: override.label };
  if (!regular) return { isSchoolDay: false, label: null };
  if (ctx.schedule.kind === "weekly") return { isSchoolDay: true, label: null };

  const labels = ctx.schedule.dayLabels;
  if (labels.length === 0) return { isSchoolDay: true, label: null };
  const anchorIndex = labels.indexOf(ctx.schedule.anchorLabel);
  if (anchorIndex === -1) {
    throw new Error(`Anchor label "${ctx.schedule.anchorLabel}" is not one of ${labels.join(", ")}`);
  }
  const offset = schoolDaysFromAnchor(date, ctx);
  const n = labels.length;
  const index = (((anchorIndex + offset) % n) + n) % n; // keeps the result positive going backward
  return { isSchoolDay: true, label: labels[index] };
}

/** Class meetings on `date`, sorted by start time. Empty on non-school days. */
export function classesOn(date: LocalDate, ctx: ScheduleContext, meetings: ClassMeeting[]): ClassMeeting[] {
  const info = dayInfo(date, ctx);
  if (!info.isSchoolDay) return [];
  const weekday = weekdayOf(date);
  return meetings
    .filter((m) =>
      ctx.schedule.kind === "rotating" && info.label !== null
        ? m.dayLabel === info.label
        : m.weekday === weekday,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
