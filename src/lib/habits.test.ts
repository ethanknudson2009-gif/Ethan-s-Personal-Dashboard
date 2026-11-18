import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import { describeTarget, strength, streak, thisWeek } from "./habits";

const TODAY = "2026-11-17"; // Tuesday
const days = (...offsets: number[]) => new Set(offsets.map((o) => addDays(TODAY, -o)));
const daily = { times: 1, per: "day" as const };
const threeAWeek = { times: 3, per: "week" as const };

describe("streak", () => {
  it("daily: counts days in a row; today not done yet doesn't break it", () => {
    expect(streak(days(0, 1, 2), daily, TODAY)).toBe(3);
    expect(streak(days(1, 2, 3), daily, TODAY)).toBe(3); // haven't done today yet
    expect(streak(days(0, 2, 3), daily, TODAY)).toBe(1); // missed yesterday
    expect(streak(days(), daily, TODAY)).toBe(0);
  });

  it("weekly: weeks in a row that hit the target", () => {
    // Last week (Mon Nov 9–Sun 15): 3 times. The week before: 3 times. This week: 1 so far.
    const c = new Set(["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-02", "2026-11-04", "2026-11-06", "2026-11-16"]);
    expect(streak(c, threeAWeek, TODAY)).toBe(2);
    c.add("2026-11-17");
    c.add("2026-11-18");
    expect(streak(c, threeAWeek, "2026-11-18")).toBe(3); // this week hit too
  });
});

describe("strength", () => {
  it("doing it every day is 100", () => {
    expect(strength(days(...Array.from({ length: 60 }, (_, i) => i)), daily, TODAY, "2026-01-01")).toBe(100);
  });

  it("one missed day only dips it a little", () => {
    const all = Array.from({ length: 60 }, (_, i) => i);
    const missedYesterday = days(...all.filter((i) => i !== 1));
    const s = strength(missedYesterday, daily, TODAY, "2026-01-01");
    expect(s).toBeGreaterThan(85);
    expect(s).toBeLessThan(100);
  });

  it("not having done today yet doesn't lower it", () => {
    const upToYesterday = days(...Array.from({ length: 59 }, (_, i) => i + 1));
    expect(strength(upToYesterday, daily, TODAY, "2026-01-01")).toBe(100);
  });

  it("3× a week at about 3 a week is ~100; never doing it is 0", () => {
    const mwf = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const d = addDays(TODAY, -i);
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (wd === 1 || wd === 3 || wd === 5) mwf.add(d);
    }
    expect(strength(mwf, threeAWeek, TODAY, "2026-01-01")).toBeGreaterThanOrEqual(90);
    expect(strength(new Set(), threeAWeek, TODAY, "2026-01-01")).toBe(0);
  });

  it("a brand-new habit started today", () => {
    expect(strength(days(0), daily, TODAY, TODAY)).toBe(100);
    expect(strength(days(), daily, TODAY, TODAY)).toBe(0);
  });
});

describe("helpers", () => {
  it("this week and labels", () => {
    expect(thisWeek(new Set(["2026-11-16", "2026-11-17", "2026-11-15"]), TODAY)).toBe(2); // Sun 15 is last week
    expect(describeTarget(daily)).toBe("Every day");
    expect(describeTarget(threeAWeek)).toBe("3× a week");
  });
});
