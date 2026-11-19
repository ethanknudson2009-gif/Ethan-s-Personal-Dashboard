/**
 * Finds date and time words in a sentence and turns them into a real
 * deadline in the user's time zone. See docs/07-architecture.md §7.
 *
 * Understands: today, tonight, tomorrow (tmrw), yesterday, weekday names
 * (fri, thurs, "this/next friday"), "in 3 days", "in 2 weeks", 11/13,
 * 11/13/26, "nov 13", "the 13th", "end of week", "weekend",
 * and times like 11:59pm, 3pm, 3p, 15:00, noon, midnight, "at 3", "by 5".
 */
import { addDays, fromLocal, toLocalDate, weekdayOf, zonedParts, type LocalDate, type LocalTime } from "@/lib/time";
import { SpanTracker } from "./spans";

export type ParsedWhen = {
  date: LocalDate;
  /** null when no time was said (we then use 11:59 PM, "end of day"). */
  time: LocalTime | null;
  dueAt: Date;
  hasTime: boolean;
};

export type DateResult = { when: ParsedWhen | null; problems: string[]; penalty: number };

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const SMALL_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

const END_OF_DAY: LocalTime = { hour: 23, minute: 59 };

/** What may NOT follow a bare number for it to count as a time ("at 3 sets" isn't 3 PM). */
const NOT_A_TIME =
  "\\s*(?:x|\\/|%|\\.\\d|lbs?|pounds|miles?|mi|km|min|mins|minutes?|hours?|hrs?|sets?|reps?|dollars|bucks|st|nd|rd|th)";

const wd = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join("|");
const mo = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

// Order matters: more specific patterns first.
const RE = {
  relative: /\b(today|tonight|tonite|tomorrow|tomorow|tmrw|tmr|yesterday)\b/g,
  inN: /\bin\s+(\d+|a|an|one|two|three|four|five|six|seven)\s+(days?|weeks?)\b/g,
  numeric: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/g,
  monthDay: new RegExp(`\\b(${mo})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "g"),
  theNth: /\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/g,
  endOfWeek: /\bend\s+of\s+(?:the\s+)?week\b/g,
  weekend: /\b(?:this\s+)?weekend\b/g,
  weekday: new RegExp(`\\b(?:(this|next)\\s+)?(${wd})\\b`, "g"),
};

const TIME_RE = {
  // "3pm", "3 pm", "11:59 p.m." — or a single letter stuck to the number ("3p"),
  // so "2 a day" isn't read as 2 AM.
  ampm: /\b(\d{1,2})(?::(\d{2}))?(?:\s*(a\.m\.|p\.m\.|am|pm)|(a|p))(?![a-z])/g,
  named: /\b(noon|midday|midnight)\b/g,
  clock: /\b(\d{1,2}):(\d{2})\b/g,
  bare: new RegExp(`(?:\\b(?:at|by)\\s+|@\\s*)(\\d{1,2})\\b(?!${NOT_A_TIME})`, "g"),
  // A number right after a day word: "sat 9", "tomorrow 3".
  afterDay: new RegExp(`\\b(?:${wd}|today|tonight|tomorrow|tmrw)\\s+(\\d{1,2})\\b(?!${NOT_A_TIME}|:)`, "g"),
};

/** Rule for an hour said without am/pm: 1–7 → PM, 8–11 → AM, 12 → noon. */
export function guessAmPm(hour: number): number {
  if (hour >= 1 && hour <= 7) return hour + 12;
  return hour; // 8–11 stay morning, 12 is noon, 0 and 13–23 are already 24-hour
}

function to24(hour: number, suffix: string): number {
  const pm = suffix.startsWith("p");
  if (hour === 12) return pm ? 12 : 0;
  return pm ? hour + 12 : hour;
}

function validDate(y: number, m: number, d: number): LocalDate | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Month/day with no year: this year, unless that was over a month ago (then next year). */
function nearestYear(today: LocalDate, m: number, d: number): LocalDate | null {
  const year = Number(today.slice(0, 4));
  const thisYear = validDate(year, m, d);
  if (thisYear && thisYear >= addDays(today, -31)) return thisYear;
  return validDate(year + 1, m, d);
}

export function parseWhen(low: string, spans: SpanTracker, now: Date, timeZone: string): DateResult {
  const today = toLocalDate(now, timeZone);
  const nowParts = zonedParts(now, timeZone);
  const problems: string[] = [];
  let penalty = 0;

  // ── 1. Time of day ──────────────────────────────────────────────────────
  let time: LocalTime | null = null;
  const take = (m: RegExpExecArray) => spans.claim(m.index, m.index + m[0].length);

  const ampm = spans.free(TIME_RE.ampm, low)[0];
  if (ampm) {
    const h = Number(ampm[1]);
    const min = Number(ampm[2] ?? 0);
    if (h >= 1 && h <= 12 && min < 60) {
      time = { hour: to24(h, ampm[3] ?? ampm[4]), minute: min };
      take(ampm);
    }
  }
  if (!time) {
    const named = spans.free(TIME_RE.named, low)[0];
    if (named) {
      time = named[1] === "midnight" ? END_OF_DAY : { hour: 12, minute: 0 };
      take(named);
    }
  }
  if (!time) {
    const clock = spans.free(TIME_RE.clock, low)[0];
    if (clock) {
      const h = Number(clock[1]);
      const min = Number(clock[2]);
      if (h <= 23 && min < 60) {
        if (h === 11 && min === 59) {
          time = END_OF_DAY; // "due 11:59" is the classic midnight deadline
        } else if (h >= 1 && h <= 7) {
          time = { hour: guessAmPm(h), minute: min };
          problems.push(`Guessed ${h}:${clock[2]} means PM`);
          penalty += 0.1;
        } else {
          time = { hour: h, minute: min };
        }
        take(clock);
      }
    }
  }
  for (const re of [TIME_RE.bare, TIME_RE.afterDay]) {
    if (time) break;
    const bare = spans.free(re, low)[0];
    if (!bare) continue;
    const h = Number(bare[1]);
    if (h < 1 || h > 12) continue;
    time = { hour: guessAmPm(h), minute: 0 };
    problems.push(`Guessed ${h} means ${h <= 7 ? `${h} PM` : h === 12 ? "noon" : `${h} AM`}`);
    penalty += 0.1;
    if (re === TIME_RE.bare) take(bare);
    else {
      // Claim only the number, so the day word ("sat") is still found as the date.
      const numStart = bare.index + bare[0].length - bare[1].length;
      spans.claim(numStart, numStart + bare[1].length);
    }
  }

  // ── 2. Date ─────────────────────────────────────────────────────────────
  let date: LocalDate | null = null;

  const relative = spans.free(RE.relative, low)[0];
  if (relative) {
    const w = relative[1];
    date = w === "yesterday" ? addDays(today, -1) : w.startsWith("to") && !w.startsWith("tom") ? today : addDays(today, 1);
    take(relative);
  }

  // "by end of day", "EOD", "close of business": today, 5 PM (work hours).
  {
    const eod = spans.free(/\b(?:by\s+)?(?:the\s+)?(?:end\s+of\s+(?:the\s+)?(?:day|business)|eod|cob|close\s+of\s+business)\b/g, low)[0];
    if (eod) {
      date ??= today;
      time ??= { hour: 17, minute: 0 };
      take(eod);
    }
  }

  if (!date) {
    const inN = spans.free(RE.inN, low)[0];
    if (inN) {
      const n = /^\d+$/.test(inN[1]) ? Number(inN[1]) : SMALL_NUMBERS[inN[1]];
      date = addDays(today, inN[2].startsWith("week") ? n * 7 : n);
      take(inN);
    }
  }

  if (!date) {
    const numeric = spans.free(RE.numeric, low)[0];
    if (numeric) {
      const m = Number(numeric[1]);
      const d = Number(numeric[2]);
      const y = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : null;
      date = y ? validDate(y, m, d) : nearestYear(today, m, d);
      if (date) take(numeric);
    }
  }

  if (!date) {
    const md = spans.free(RE.monthDay, low)[0];
    if (md) {
      date = nearestYear(today, MONTHS[md[1]], Number(md[2]));
      if (date) take(md);
    }
  }

  if (!date) {
    const nth = spans.free(RE.theNth, low)[0];
    if (nth) {
      const d = Number(nth[1]);
      const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
      const thisMonth = validDate(y, m, d);
      date = thisMonth && thisMonth >= today ? thisMonth : validDate(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, d);
      if (date) take(nth);
    }
  }

  const nextWeekday = (target: number, allowToday: boolean) => {
    let diff = (target - weekdayOf(today) + 7) % 7;
    if (diff === 0 && !allowToday) diff = 7;
    return addDays(today, diff);
  };

  if (!date) {
    const eow = spans.free(RE.endOfWeek, low)[0];
    if (eow) {
      date = nextWeekday(5, true);
      take(eow);
    }
  }

  if (!date) {
    const weekend = spans.free(RE.weekend, low)[0];
    if (weekend) {
      date = nextWeekday(6, true);
      take(weekend);
    }
  }

  if (!date) {
    const day = spans.free(RE.weekday, low)[0];
    if (day) {
      const target = WEEKDAYS[day[2]];
      const isToday = target === weekdayOf(today);
      // Today counts only if the time (if any) hasn't passed yet.
      const timeStillAhead =
        time === null || time.hour * 60 + time.minute > nowParts.hour * 60 + nowParts.minute;
      date = nextWeekday(target, isToday && timeStillAhead && day[1] !== "next");
      if (day[1] === "next" && !isToday) {
        problems.push(`"next ${day[2]}" could mean this week or next week; picked ${date}`);
        penalty += 0.1;
      }
      take(day);
    }
  }

  // A time with no date: today if it's still ahead, otherwise tomorrow.
  if (!date && time) {
    const ahead = time.hour * 60 + time.minute > nowParts.hour * 60 + nowParts.minute;
    date = ahead ? today : addDays(today, 1);
  }

  if (!date) return { when: null, problems, penalty };

  const hasTime = time !== null;
  const dueAt = fromLocal(date, time ?? END_OF_DAY, timeZone);
  return { when: { date, time, dueAt, hasTime }, problems, penalty };
}
