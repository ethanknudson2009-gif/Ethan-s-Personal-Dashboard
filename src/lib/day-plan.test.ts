import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { leftForToday, planCandidates, ritualFor, suggestTop3, tomorrowDue, type PlanTask } from "./day-plan";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);
const now = at("2026-11-19", 8); // Thursday morning
const task = (id: string, due: Date | null, time = false): PlanTask => ({ id, due_at: due?.toISOString() ?? null, due_has_time: time });

const open = [
  task("next-week", at("2026-11-27", 23, 59)),
  task("someday", null),
  task("tomorrow", at("2026-11-20", 23, 59)),
  task("quiz-today-3pm", at("2026-11-19", 15), true),
  task("overdue", at("2026-11-17", 23, 59)),
  task("today", at("2026-11-19", 23, 59)),
  task("saturday", at("2026-11-21", 23, 59)),
];

describe("which ritual", () => {
  it("plan in the morning, shut down in the evening", () => {
    expect(ritualFor(at("2026-11-19", 7), PHX)).toBe("morning");
    expect(ritualFor(at("2026-11-19", 11, 59), PHX)).toBe("morning");
    expect(ritualFor(at("2026-11-19", 14), PHX)).toBe("day");
    expect(ritualFor(at("2026-11-19", 17), PHX)).toBe("evening");
    expect(ritualFor(at("2026-11-19", 23, 30), PHX)).toBe("evening");
    expect(ritualFor(at("2026-11-20", 1), PHX)).toBe("evening"); // still last night
  });
});

describe("morning plan", () => {
  it("lists the most urgent first, leaves out next week", () => {
    expect(planCandidates(open, now, PHX).map((t) => t.id)).toEqual(["overdue", "quiz-today-3pm", "today", "tomorrow", "saturday", "someday"]);
  });
  it("pre-picks the top 3", () => {
    expect(suggestTop3(open, now, PHX)).toEqual(["overdue", "quiz-today-3pm", "today"]);
    expect(suggestTop3([], now, PHX)).toEqual([]);
  });
});

describe("evening shutdown", () => {
  it("what's left: due today or overdue, plus your top 3", () => {
    const evening = at("2026-11-19", 20);
    expect(leftForToday(open, ["saturday"], evening, PHX).map((t) => t.id)).toEqual(["quiz-today-3pm", "overdue", "today", "saturday"]);
  });
  it("moves to tomorrow, keeping the time of day", () => {
    const evening = at("2026-11-19", 20);
    expect(tomorrowDue(task("q", at("2026-11-19", 15), true), evening, PHX)).toBe(at("2026-11-20", 15).toISOString());
    expect(tomorrowDue(task("d", at("2026-11-17", 23, 59)), evening, PHX)).toBe(at("2026-11-20", 23, 59).toISOString());
    expect(tomorrowDue(task("n", null), evening, PHX)).toBe(at("2026-11-20", 23, 59).toISOString());
  });
});
