import { describe, expect, it } from "vitest";
import { musclesOfDay, planForDay, type PastSession } from "./gym-plan";

const ex = [
  { id: "bench", name: "Bench press" },
  { id: "incline", name: "Incline dumbbell press" },
  { id: "fly", name: "Chest fly" },
  { id: "pushups", name: "Push-ups" },
  { id: "pulldown", name: "Lat pulldown" },
  { id: "row", name: "Barbell row" },
  { id: "curl", name: "Bicep curl" },
  { id: "hammer", name: "Hammer curl" },
];
const set = (exerciseId: string, weightLb: number | null, reps: number | null, done = true) => ({ exerciseId, weightLb, reps, done });

describe("musclesOfDay", () => {
  it("reads the split day's name", () => {
    expect(musclesOfDay("Back & Biceps")).toEqual(["back", "biceps"]);
    expect(musclesOfDay("Shoulders & Triceps")).toEqual(["shoulders", "triceps"]);
    expect(musclesOfDay("Push")).toEqual(["push"]);
    expect(musclesOfDay("Upper")).toEqual(["upper body"]);
  });
});

describe("planForDay", () => {
  it("repeats last time's workout for that day, without the unfinished sets", () => {
    const history: PastSession[] = [
      { day: "Legs", skipped: false, sets: [set("row", 100, 5)] },
      { day: "Chest", skipped: true, sets: [] },
      { day: "Chest", skipped: false, sets: [set("bench", 135, 10), set("bench", 155, 8), set("fly", 40, 12), set("fly", null, null, false)] },
      { day: "Chest", skipped: false, sets: [set("pushups", null, 20)] },
    ];
    expect(planForDay("Chest", history, ex)).toEqual({
      from: "last time",
      sets: [
        { exerciseId: "bench", weightLb: 135, reps: 10 },
        { exerciseId: "bench", weightLb: 155, reps: 8 },
        { exerciseId: "fly", weightLb: 40, reps: 12 },
      ],
    });
  });

  it("first time: starter exercises, with weights you've used before", () => {
    const history: PastSession[] = [{ day: null, skipped: false, sets: [set("curl", 30, 10), set("curl", 30, 9)] }];
    const plan = planForDay("Back & Biceps", history, ex);
    expect(plan.from).toBe("starter");
    expect([...new Set(plan.sets.map((s) => s.exerciseId))]).toEqual(["pulldown", "row", "curl", "hammer"]);
    expect(plan.sets.filter((s) => s.exerciseId === "curl")).toEqual([
      { exerciseId: "curl", weightLb: 30, reps: 10 },
      { exerciseId: "curl", weightLb: 30, reps: 9 },
    ]);
    expect(plan.sets.filter((s) => s.exerciseId === "row")).toHaveLength(3);
  });

  it("a day name it can't read starts empty", () => {
    expect(planForDay("Mystery", [], ex)).toEqual({ from: "empty", sets: [] });
  });
});
