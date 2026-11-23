import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY } from "./exercise-library";
import { changeLabel, planFix, readFix } from "./gym-fix";

const EX = EXERCISE_LIBRARY.map((e) => ({ id: e.name, name: e.name, muscle: e.muscle, bodyweight: e.bodyweight }));
const fix = (s: string) => readFix(s, EX);

describe("hearing a fix", () => {
  it("Ethan's example", () => {
    expect(fix("on my last back day, I actually hit that dumbbell row for 12 reps not 10")).toMatchObject({
      exercise: "Dumbbell row",
      field: "reps",
      to: 12,
      from: 10,
      day: { kind: "split", word: "back" },
    });
  });

  it.each([
    ["yesterday's bench was 145 not 135", { exercise: "Bench press", to: 145, from: 135, day: { kind: "daysAgo", n: 1 } }],
    ["change my last set of squats to 8 reps", { exercise: "Squat", to: 8, field: "reps", set: "last" }],
    ["actually on monday I did lat pulldown at 120 instead of 110", { exercise: "Lat pulldown", to: 120, from: 110, day: { kind: "weekday", day: 1 } }],
    ["fix my incline dumbbell press from 50 to 55 pounds", { exercise: "Incline dumbbell press", from: 50, to: 55, field: "weightLb" }],
    ["the second set of RDLs was actually 10 reps", { exercise: "Romanian deadlift", to: 10, field: "reps", set: 1 }],
    ["last leg day leg press was 3 plates not 2", { exercise: "Leg press", day: { kind: "split", word: "leg" } }],
    ["not 8 but 10 reps on skull crushers today", { exercise: "Skull crushers", from: 8, to: 10, field: "reps", day: { kind: "daysAgo", n: 0 } }],
  ])("%s", (said, want) => expect(fix(said)).toMatchObject(want));

  it("new workouts and normal talk aren't fixes", () => {
    expect(fix("bench 3x10 at 135")).toBeNull();
    expect(fix("I need to call Mike about the Garcia file")).toBeNull();
    expect(fix("chest day bench 135 for 10 incline 50 for 8")).toBeNull();
    expect(fix("actually did bench 3x10 at 135 today")).toBeNull();
    expect(fix("I need to fix my car tomorrow")).toBeNull();
  });
});

describe("planning the change", () => {
  const sets = [
    { id: "a", weightLb: 60, reps: 10 },
    { id: "b", weightLb: 60, reps: 10 },
    { id: "c", weightLb: 60, reps: 8 },
  ];
  const base = { exerciseId: "x", exercise: "Dumbbell row", day: null } as const;

  it("'12 not 10' changes the sets that were 10", () => {
    const c = planFix({ ...base, field: "reps", to: 12, from: 10, set: null }, sets);
    expect(c.map((x) => x.setId)).toEqual(["a", "b"]);
    expect(changeLabel(c[0])).toBe("Set 1: 10 → 12 reps");
  });

  it("works out reps vs weight from the old number", () => {
    expect(planFix({ ...base, field: null, to: 65, from: 60, set: null }, sets)[0]).toMatchObject({ field: "weightLb", before: 60, after: 65 });
    expect(planFix({ ...base, field: null, to: 9, from: 8, set: null }, sets)).toMatchObject([{ setId: "c", field: "reps" }]);
  });

  it("a set number, 'last set' or 'all sets'", () => {
    expect(planFix({ ...base, field: "reps", to: 11, from: null, set: 1 }, sets).map((x) => x.setId)).toEqual(["b"]);
    expect(planFix({ ...base, field: "reps", to: 11, from: null, set: "last" }, sets).map((x) => x.setId)).toEqual(["c"]);
    expect(planFix({ ...base, field: "weightLb", to: 65, from: null, set: "all" }, sets)).toHaveLength(3);
  });

  it("no set said and sets differ → the last one; nothing to change → empty", () => {
    expect(planFix({ ...base, field: "reps", to: 9, from: null, set: null }, sets).map((x) => x.setId)).toEqual(["c"]);
    expect(planFix({ ...base, field: "reps", to: 8, from: null, set: "last" }, sets)).toEqual([]);
  });
});
