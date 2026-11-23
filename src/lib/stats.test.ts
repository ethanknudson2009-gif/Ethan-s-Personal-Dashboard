import { describe, expect, it } from "vitest";
import { bestLifts, busiestWeekday, compact, delta, habitRate, lastDays, lastWeeks, mondayOf, mostCommon, onTimeRate, shortDate, sumByDay, sumByWeek, volume, weeksInARow } from "./stats";

describe("weeks and days", () => {
  it("finds the Monday of a week (Sunday belongs to the week before)", () => {
    expect(mondayOf("2026-11-23")).toBe("2026-11-23"); // Monday
    expect(mondayOf("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(mondayOf("2026-11-26")).toBe("2026-11-23"); // Thursday
  });
  it("lists the last weeks and days, oldest first", () => {
    expect(lastWeeks("2026-11-25", 3)).toEqual(["2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(lastDays("2026-11-23", 3)).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
  });
  it("adds things up per week and per day, ignoring dates outside", () => {
    const rows = [{ d: "2026-11-16", n: 2 }, { d: "2026-11-22", n: 1 }, { d: "2026-11-24", n: 5 }, { d: "2026-10-01", n: 99 }, { d: null, n: 7 }];
    expect(sumByWeek(rows, (r) => r.d, (r) => r.n, ["2026-11-16", "2026-11-23"])).toEqual([3, 5]);
    expect(sumByDay(rows, (r) => r.d, (r) => r.n, ["2026-11-22", "2026-11-23", "2026-11-24"])).toEqual([1, 0, 5]);
  });
});

describe("numbers", () => {
  it("this week vs last week", () => {
    expect(delta(12, 8)).toEqual({ now: 12, before: 8, change: 4, percent: 50 });
    expect(delta(3, 0).percent).toBeNull();
  });
  it("habit rate only counts days since the habit started", () => {
    const set = new Set(["2026-11-22", "2026-11-23"]);
    expect(habitRate(set, "2026-11-23", 30, "2026-11-20")).toEqual({ hit: 2, of: 4 });
  });
  it("volume counts finished sets with weight and reps", () => {
    expect(
      volume([
        { weightLb: 135, reps: 10, done: true },
        { weightLb: 135, reps: 8, done: false },
        { weightLb: null, reps: 12, done: true },
      ]),
    ).toBe(1350);
  });
  it("best lifts: heaviest per exercise, heaviest first", () => {
    const sets = [
      { exercise: "Bench press", weightLb: 185, reps: 5, done: true, day: "2026-11-02" },
      { exercise: "Bench press", weightLb: 205, reps: 3, done: true, day: "2026-11-16" },
      { exercise: "Bench press", weightLb: 225, reps: 1, done: false, day: "2026-11-20" },
      { exercise: "Squat", weightLb: 275, reps: 5, done: true, day: "2026-11-18" },
      { exercise: "Squat", weightLb: 275, reps: 6, done: true, day: "2026-11-19" },
    ];
    expect(bestLifts(sets)).toEqual([
      { exercise: "Squat", weightLb: 275, reps: 6, day: "2026-11-19" },
      { exercise: "Bench press", weightLb: 205, reps: 3, day: "2026-11-16" },
    ]);
  });
  it("short labels", () => {
    expect(shortDate("2026-11-23")).toBe("Nov 23");
    expect(compact(950)).toBe("950");
    expect(compact(1250)).toBe("1.3k");
    expect(compact(12400)).toBe("12k");
    expect(compact(2_000_000)).toBe("2M");
  });
});

describe("highlights", () => {
  it("on-time rate skips tasks with no due date", () => {
    expect(
      onTimeRate([
        { completedAt: "2026-11-20T10:00:00Z", dueAt: "2026-11-20T12:00:00Z" },
        { completedAt: "2026-11-21T10:00:00Z", dueAt: "2026-11-20T12:00:00Z" },
        { completedAt: "2026-11-21T10:00:00Z", dueAt: null },
      ]),
    ).toEqual({ onTime: 1, of: 2 });
  });
  it("busiest weekday", () => {
    expect(busiestWeekday(["2026-11-23", "2026-11-30", "2026-11-24"])).toBe(1); // Mondays
    expect(busiestWeekday([])).toBeNull();
  });
  it("weeks in a row: an empty current week doesn't break the streak", () => {
    expect(weeksInARow([1, 0, 2, 3, 0])).toBe(2);
    expect(weeksInARow([1, 1, 1])).toBe(3);
    expect(weeksInARow([1, 0, 0])).toBe(0);
  });
  it("most common", () => {
    expect(mostCommon(["Bench", "Squat", "Bench"])).toEqual({ item: "Bench", count: 2 });
    expect(mostCommon([])).toBeNull();
  });
});
