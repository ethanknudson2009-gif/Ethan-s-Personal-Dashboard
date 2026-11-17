/**
 * The Cushion: "study time you have" minus "study time you need" before
 * each deadline. See docs/07-architecture.md §9.1.
 *
 * All open assignments are counted together: two things due Friday share
 * the same evenings, so the second one's cushion includes the first one's work.
 */
import { addDays, compareLocalDates, toLocalDate, weekdayOf, zonedParts, type LocalTime } from "@/lib/time";

export type CushionTask = {
  id: string;
  dueAt: Date;
  estimateMinutes: number | null;
  minutesDone: number;
};

export type StudySettings = {
  /** Minutes of study per weekday, Sunday first. Default: 120 Mon–Fri. */
  studyMinutes: number[];
  /** You stop studying at this time each night. Default 22:00. */
  studyEndTime: LocalTime;
  timeZone: string;
};

export type CushionLabel = "ahead" | "tight" | "behind";

export type CushionResult = {
  /** Available minus needed. Negative means you're short. */
  minutes: number;
  label: CushionLabel;
  availableMinutes: number;
  neededMinutes: number;
  /** True when the task had no estimate and we assumed DEFAULT_ESTIMATE_MINUTES. */
  estimateMissing: boolean;
};

export const DEFAULT_ESTIMATE_MINUTES = 30;
/** A deadline at or after 8:00 PM leaves that evening to work; earlier deadlines don't. */
export const DUE_DAY_COUNTS_FROM_HOUR = 20;
/** 60+ minutes spare = ahead; 0–59 = tight; below 0 = behind. */
export const AHEAD_THRESHOLD_MINUTES = 60;

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  studyMinutes: [0, 120, 120, 120, 120, 120, 0],
  studyEndTime: { hour: 22, minute: 0 },
  timeZone: "America/Phoenix",
};

export function labelFor(minutes: number): CushionLabel {
  if (minutes >= AHEAD_THRESHOLD_MINUTES) return "ahead";
  if (minutes >= 0) return "tight";
  return "behind";
}

/** Study minutes left between `now` and the deadline `dueAt`. */
export function availableMinutes(now: Date, dueAt: Date, settings: StudySettings): number {
  if (dueAt.getTime() <= now.getTime()) return 0;

  const { timeZone, studyMinutes, studyEndTime } = settings;
  const today = toLocalDate(now, timeZone);
  const dueDay = toLocalDate(dueAt, timeZone);
  const due = zonedParts(dueAt, timeZone);
  const dueDayCounts = due.hour >= DUE_DAY_COUNTS_FROM_HOUR;

  const nowParts = zonedParts(now, timeZone);
  const minutesLeftToday = Math.max(
    0,
    studyEndTime.hour * 60 + studyEndTime.minute - (nowParts.hour * 60 + nowParts.minute),
  );

  let total = 0;
  for (let day = today; compareLocalDates(day, dueDay) <= 0; day = addDays(day, 1)) {
    if (day === dueDay && !dueDayCounts) break;
    const capacity = studyMinutes[weekdayOf(day)] ?? 0;
    total += day === today ? Math.min(capacity, minutesLeftToday) : capacity;
  }
  return total;
}

/** Cushion for every open task. Pass only tasks that aren't done. */
export function cushion(tasks: CushionTask[], settings: StudySettings, now: Date): Map<string, CushionResult> {
  const sorted = [...tasks].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const results = new Map<string, CushionResult>();

  let neededSoFar = 0;
  for (const task of sorted) {
    const estimateMissing = task.estimateMinutes == null;
    const estimate = task.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES;
    neededSoFar += Math.max(estimate - task.minutesDone, 0);

    const available = availableMinutes(now, task.dueAt, settings);
    const minutes = available - neededSoFar;
    results.set(task.id, {
      minutes,
      label: labelFor(minutes),
      availableMinutes: available,
      neededMinutes: neededSoFar,
      estimateMissing,
    });
  }
  return results;
}

/** "1 h 30 m", "45 m", "2 h" — for showing cushions and estimates. */
export function formatMinutes(total: number): string {
  const sign = total < 0 ? "−" : "";
  const abs = Math.abs(Math.round(total));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} m`;
  if (m === 0) return `${sign}${h} h`;
  return `${sign}${h} h ${m} m`;
}
