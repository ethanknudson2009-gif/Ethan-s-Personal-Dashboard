/**
 * Phrases from a "talk to it like a real teenager" stress test.
 * Each one was wrong once; these keep them fixed.
 */
import { describe, expect, it } from "vitest";
import { parseMany } from "./multi";
import type { ParseContext } from "./index";
import { readWorkout } from "../gym-speech";
import { planFix, readFix } from "../gym-fix";
import { EXERCISE_LIBRARY } from "../exercise-library";

const EX = EXERCISE_LIBRARY.map((e) => ({ id: e.name, name: e.name, muscle: e.muscle, bodyweight: e.bodyweight }));
const ctx: ParseContext = {
  now: new Date("2026-11-23T17:00:00Z"),
  timeZone: "America/Phoenix",
  spoken: true,
  classes: [
    { id: "h", name: "World History", shortNames: ["history"] },
    { id: "m", name: "College Algebra", shortNames: ["math", "algebra"] },
  ],
  habits: ["Read", "Drink water", "Stretch"],
};
const one = (said: string) => {
  const all = parseMany(said, ctx);
  expect(all).toHaveLength(1);
  return all[0].draft;
};
const sets = (said: string) =>
  readWorkout(said, EX).entries.map((e) => ({ name: e.name, known: !!e.exerciseId, sets: e.sets.map((s) => [s.reps, s.weightLb]) }));

describe("correcting yourself mid-sentence", () => {
  it.each([
    ["tricep school crusher 2 sets of 80 pounds for 10 reps excuse me I mean 60 pounds", "Skull crushers", 2, 10, 60],
    ["bench 185 for 8 no wait 6", "Bench press", 1, 6, 185],
    ["squat 225 for 5 sorry 235 for 5", "Squat", 1, 5, 235],
  ])("%s", (said, name, n, reps, lb) => {
    const [e] = sets(said);
    expect(e).toMatchObject({ name, known: true });
    expect(e.sets).toHaveLength(n);
    expect(e.sets.every(([r, w]) => r === reps && w === lb)).toBe(true);
  });
});

describe("how gym talk really sounds", () => {
  it.each([
    ["lat pull down 3 by 12 at 120", "Lat pulldown", 3, 12, 120],
    ["calf raises 4 by 20", "Calf raise", 4, 20, null],
    ["hammer curls 3x12 with 35s", "Hammer curl", 3, 12, 35],
    ["cable flys 3 sets of 15 at 30", "Cable fly", 3, 15, 30],
    ["rdls 135 for 10 3 sets", "Romanian deadlift", 3, 10, 135],
    ["did pull ups 3 sets of 8", "Pull-ups", 3, 8, null],
  ])("%s", (said, name, n, reps, lb) => {
    const all = sets(said);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name, known: true });
    expect(all[0].sets).toHaveLength(n);
    expect(all[0].sets[0]).toEqual([reps, lb]);
  });

  it("plank for 60 seconds 3 times is 3 sets of 60", () => {
    const all = sets("plank for 60 seconds 3 times");
    expect(all).toHaveLength(1);
    expect(all[0].sets).toEqual([[60, null], [60, null], [60, null]]);
  });

  it("gym numbers are workouts, not times", () => {
    const d = one("lat pull down 3 by 12 at 120");
    expect(d.type).toBe("workout");
    expect(d.when?.time ?? null).toBeNull();
  });

  it("drank water checks off the habit", () => {
    expect(one("drank water")).toMatchObject({ type: "habit" });
  });
});

describe("fixing a past workout", () => {
  it("'4 sets not 3' isn't guessed as a rep or weight change", () => {
    const f = readFix("on my last chest day I actually did 4 sets not 3 on bench", EX);
    expect(f).toMatchObject({ exercise: "Bench press", field: "sets" });
    expect(planFix(f!, [{ id: "a", weightLb: 185, reps: 3 }])).toEqual([]);
  });
});

describe("school and work phrasing", () => {
  it("Mike wants the Garcia LE sent out today before 3", () => {
    expect(one("Mike wants the Garcia LE sent out today before 3")).toMatchObject({
      type: "task",
      title: "Send out the Garcia LE",
      area: "work",
      when: { date: "2026-11-23", time: { hour: 15, minute: 0 } },
    });
  });

  it("my algebra homework is pages 45 through 50", () => {
    expect(one("my algebra homework is pages 45 through 50 due friday")).toMatchObject({
      type: "homework",
      className: "College Algebra",
      when: { date: "2026-11-27" },
    });
    expect(one("my algebra homework is pages 45 through 50 due friday").title).not.toMatch(/\bis\b/);
  });

  it("teachers' names get capitals", () => {
    expect(one("email mrs johnson about the late essay").title).toBe("Email Mrs Johnson about the late essay");
    expect(one("ask mr. smith about the retake").title).toMatch(/Mr Smith/);
  });

  it("'before 3 sets' still isn't a time", () => {
    expect(one("do pushups before 3 sets of squats").when?.time ?? null).toBeNull();
  });
});
