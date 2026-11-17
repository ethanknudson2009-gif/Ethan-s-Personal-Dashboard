import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { daysUntil, formatClock, formatDue, formatLocalDate, formatTimeOfDay, taskDisplayTitle } from "./format";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);
const NOW = at("2026-11-10", 16); // Tue 4 PM

describe("format", () => {
  it("clock times", () => {
    expect(formatClock(0, 0)).toBe("12:00 AM");
    expect(formatClock(12, 0)).toBe("12:00 PM");
    expect(formatClock(23, 59)).toBe("11:59 PM");
    expect(formatTimeOfDay("08:00:00")).toBe("8:00 AM");
    expect(formatTimeOfDay("15:30:00")).toBe("3:30 PM");
  });

  it("dates", () => {
    expect(formatLocalDate("2026-11-13")).toBe("Fri, Nov 13");
  });

  it("deadlines relative to now", () => {
    expect(formatDue(at("2026-11-10", 23, 59), true, NOW, PHX)).toBe("Today · 11:59 PM");
    expect(formatDue(at("2026-11-11", 23, 59), false, NOW, PHX)).toBe("Tomorrow");
    expect(formatDue(at("2026-11-13", 15), true, NOW, PHX)).toBe("Fri, Nov 13 · 3:00 PM");
    expect(formatDue(at("2026-11-09", 23, 59), false, NOW, PHX)).toBe("Overdue · Yesterday");
    expect(formatDue(at("2026-11-02", 9), true, NOW, PHX)).toBe("Overdue · Mon, Nov 2 · 9:00 AM");
  });

  it("days until", () => {
    expect(daysUntil(at("2026-11-13", 9), NOW, PHX)).toBe(3);
    expect(daysUntil(at("2026-11-09", 9), NOW, PHX)).toBe(-1);
  });

  it("class-first titles", () => {
    expect(taskDisplayTitle('"What is Equal" Journal', "Speech")).toBe('Speech: "What is Equal" Journal');
    expect(taskDisplayTitle("Call mom", null)).toBe("Call mom");
  });
});
