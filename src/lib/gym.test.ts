import { describe, expect, it } from "vitest";
import { bestByExercise, lastTime, newRecords, oneRepMax, setLabel, volume } from "./gym";

describe("gym math", () => {
  it("estimated one-rep max", () => {
    expect(oneRepMax(135, 10)).toBe(180);
    expect(oneRepMax(225, 1)).toBe(225);
    expect(oneRepMax(0, 10)).toBe(0);
  });

  it("volume counts only finished sets", () => {
    expect(
      volume([
        { exerciseId: "bench", weightLb: 135, reps: 10 },
        { exerciseId: "bench", weightLb: 135, reps: 8, done: false },
        { exerciseId: "pushup", weightLb: null, reps: 20 },
      ]),
    ).toBe(1350);
  });

  it("best per exercise and new records", () => {
    const history = [
      { exerciseId: "bench", weightLb: 135, reps: 10 }, // 180
      { exerciseId: "squat", weightLb: 185, reps: 5 }, // 216
    ];
    const today = [
      { exerciseId: "bench", weightLb: 145, reps: 10 }, // 193 → PR
      { exerciseId: "squat", weightLb: 185, reps: 3 }, // 204 → not a PR
      { exerciseId: "curl", weightLb: 30, reps: 12 }, // first time → not a "record" yet
    ];
    expect(bestByExercise(today).get("bench")).toBe(193);
    expect(newRecords(today, history)).toEqual([{ exerciseId: "bench", e1rm: 193, previous: 180 }]);
  });

  it("pre-fills from the most recent workout that had the exercise", () => {
    const workouts = [
      [{ exerciseId: "squat", weightLb: 185, reps: 5 }], // newest
      [
        { exerciseId: "bench", weightLb: 135, reps: 10 },
        { exerciseId: "bench", weightLb: 135, reps: 9 },
      ],
    ];
    expect(lastTime("bench", workouts)).toHaveLength(2);
    expect(lastTime("deadlift", workouts)).toEqual([]);
    expect(setLabel({ weightLb: 135, reps: 10 })).toBe("135 × 10");
    expect(setLabel({ weightLb: null, reps: 20 })).toBe("BW × 20");
  });
});
