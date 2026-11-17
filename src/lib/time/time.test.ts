import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  fromLocal,
  parseLocalDate,
  startOfLocalDay,
  toLocalDate,
  weekdayOf,
  zonedParts,
} from "./index";

const PHX = "America/Phoenix";
const LA = "America/Los_Angeles"; // uses daylight saving time, for contrast

describe("fromLocal", () => {
  it("turns Fri Nov 13 11:59pm Phoenix into the right UTC instant", () => {
    expect(fromLocal("2026-11-13", { hour: 23, minute: 59 }, PHX).toISOString()).toBe(
      "2026-11-14T06:59:00.000Z",
    );
  });

  it("Phoenix is UTC-7 in summer too (no daylight saving)", () => {
    expect(fromLocal("2026-07-04", { hour: 12, minute: 0 }, PHX).toISOString()).toBe(
      "2026-07-04T19:00:00.000Z",
    );
  });

  it("Phoenix doesn't shift on the weekends other states change clocks", () => {
    // US clocks changed on Mar 8 and Nov 1, 2026. Phoenix stays at -7 both sides.
    for (const day of ["2026-03-07", "2026-03-08", "2026-03-09", "2026-10-31", "2026-11-01", "2026-11-02"]) {
      const utcHour = fromLocal(day, { hour: 9, minute: 0 }, PHX).getUTCHours();
      expect(utcHour, day).toBe(16);
    }
  });

  it("Los Angeles does shift, proving the zone setting is respected", () => {
    expect(fromLocal("2026-07-04", { hour: 12, minute: 0 }, LA).getUTCHours()).toBe(19);
    expect(fromLocal("2026-12-04", { hour: 12, minute: 0 }, LA).getUTCHours()).toBe(20);
  });
});

describe("toLocalDate / zonedParts", () => {
  it("late evening in Phoenix is already tomorrow in UTC, but still today locally", () => {
    const instant = new Date("2026-11-11T05:30:00Z"); // Tue Nov 10, 10:30pm in Phoenix
    expect(toLocalDate(instant, PHX)).toBe("2026-11-10");
    expect(zonedParts(instant, PHX)).toMatchObject({ weekday: 2, hour: 22, minute: 30 });
  });

  it("round-trips with fromLocal", () => {
    const instant = fromLocal("2026-02-28", { hour: 0, minute: 0 }, PHX);
    expect(toLocalDate(instant, PHX)).toBe("2026-02-28");
    expect(startOfLocalDay("2026-02-28", PHX).toISOString()).toBe("2026-02-28T07:00:00.000Z");
  });
});

describe("calendar math", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29"); // leap year
  });

  it("knows the weekday", () => {
    expect(weekdayOf("2026-11-10")).toBe(2); // Tuesday
    expect(weekdayOf("2026-11-13")).toBe(5); // Friday
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-10", "2026-11-13")).toBe(3);
    expect(daysBetween("2026-11-13", "2026-11-10")).toBe(-3);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("rejects bad dates", () => {
    expect(() => parseLocalDate("2026-02-30")).toThrow();
    expect(() => parseLocalDate("11/13/2026")).toThrow();
  });
});
