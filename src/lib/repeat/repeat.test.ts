import { describe, expect, it } from "vitest";
import { fromLocal, toLocalDate, zonedParts } from "@/lib/time";
import { addMonths, nextDue, type RepeatRule } from "./index";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);
const day = (d: Date | null) => (d ? toLocalDate(d, PHX) : null);

describe("fixed repeats (follow the calendar)", () => {
  const everyMonday: RepeatRule = { mode: "fixed", every: 1, unit: "week" };

  it("every week, finished on time → next week, same time", () => {
    const next = nextDue(everyMonday, at("2026-11-09", 16), at("2026-11-09", 15), PHX);
    expect(day(next)).toBe("2026-11-16");
    expect(zonedParts(next!, PHX)).toMatchObject({ hour: 16, minute: 0 });
  });

  it("finished 2 weeks late → next upcoming Monday, not a pile of overdue copies", () => {
    const next = nextDue(everyMonday, at("2026-11-09", 16), at("2026-11-25", 12), PHX);
    expect(day(next)).toBe("2026-11-30");
  });

  it("specific weekdays: Mon & Wed", () => {
    const monWed: RepeatRule = { mode: "fixed", every: 1, unit: "week", weekdays: [1, 3] };
    expect(day(nextDue(monWed, at("2026-11-09", 8), at("2026-11-09", 7), PHX))).toBe("2026-11-11");
    expect(day(nextDue(monWed, at("2026-11-11", 8), at("2026-11-11", 7), PHX))).toBe("2026-11-16");
  });

  it("every 2 weeks on Tuesday", () => {
    const biweekly: RepeatRule = { mode: "fixed", every: 2, unit: "week", weekdays: [2] };
    expect(day(nextDue(biweekly, at("2026-11-10", 9), at("2026-11-10", 8), PHX))).toBe("2026-11-24");
  });

  it("daily and monthly", () => {
    const daily: RepeatRule = { mode: "fixed", every: 1, unit: "day" };
    expect(day(nextDue(daily, at("2026-11-30", 21), at("2026-11-30", 20), PHX))).toBe("2026-12-01");
    const monthly: RepeatRule = { mode: "fixed", every: 1, unit: "month" };
    expect(day(nextDue(monthly, at("2026-01-31", 12), at("2026-01-31", 11), PHX))).toBe("2026-02-28");
  });

  it("stops after the until date", () => {
    const rule: RepeatRule = { ...everyMonday, until: "2026-11-20" };
    expect(day(nextDue(rule, at("2026-11-09", 16), at("2026-11-09", 15), PHX))).toBe("2026-11-16");
    expect(nextDue(rule, at("2026-11-16", 16), at("2026-11-16", 15), PHX)).toBeNull();
  });
});

describe("after-completion repeats (count from when you finished)", () => {
  it("water plants 7 days after I last did it", () => {
    const rule: RepeatRule = { mode: "after_completion", every: 7, unit: "day" };
    // Due Nov 10, actually done Nov 12 → next due Nov 19 (same time of day as before).
    const next = nextDue(rule, at("2026-11-10", 18), at("2026-11-12", 9), PHX);
    expect(day(next)).toBe("2026-11-19");
    expect(zonedParts(next!, PHX).hour).toBe(18);
  });

  it("window-washing customer every 8 weeks after the last job", () => {
    const rule: RepeatRule = { mode: "after_completion", every: 8, unit: "week" };
    expect(day(nextDue(rule, at("2026-11-14", 9), at("2026-11-15", 11), PHX))).toBe("2027-01-10");
  });

  it("uses the local day, even late at night when UTC is already tomorrow", () => {
    const rule: RepeatRule = { mode: "after_completion", every: 1, unit: "day" };
    // Done Tue 11:30 PM Phoenix (= Wed 06:30 UTC) → next due Wednesday, not Thursday.
    expect(day(nextDue(rule, at("2026-11-10", 20), at("2026-11-10", 23, 30), PHX))).toBe("2026-11-11");
  });
});

describe("addMonths", () => {
  it("clamps to the end of shorter months and handles years", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});
