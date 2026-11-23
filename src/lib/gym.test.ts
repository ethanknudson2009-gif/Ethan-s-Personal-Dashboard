import { describe, expect, it } from "vitest";
import * as gymMod from "./gym";
import { bestByExercise, lastTime, matchExercise, newRecords, oneRepMax, setLabel, volume } from "./gym";

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

describe("matching what you said to an exercise", () => {
  const list = [
    "Bench press", "Incline dumbbell press", "Push-ups", "Squat", "Leg press", "Romanian deadlift", "Deadlift",
    "Pull-ups", "Lat pulldown", "Barbell row", "Overhead press", "Bicep curl", "Hammer curl", "Plank (seconds)",
  ].map((name, i) => ({ id: String(i), name }));
  const m = (s: string) => matchExercise(s, list)?.name ?? null;

  it("exact names, plurals and nicknames", () => {
    expect(m("Squats")).toBe("Squat");
    expect(m("bench")).toBe("Bench press");
    expect(m("Pull ups")).toBe("Pull-ups");
    expect(m("pullups")).toBe("Pull-ups");
    expect(m("curls")).toBe("Bicep curl");
    expect(m("hammer curls")).toBe("Hammer curl");
    expect(m("RDL")).toBe("Romanian deadlift");
    expect(m("deadlifts")).toBe("Deadlift");
    expect(m("lat pulldown")).toBe("Lat pulldown");
    expect(m("OHP")).toBe("Overhead press");
    expect(m("plank")).toBe("Plank (seconds)");
  });

  it("partial names, and nothing when unsure", () => {
    expect(m("incline")).toBe("Incline dumbbell press");
    expect(m("rows")).toBe("Barbell row");
    expect(m("zumba")).toBeNull();
  });
});

describe("split rotation", () => {
  const split = ["Chest", "Back & Biceps", "Legs", "Shoulders & Triceps"];
  it("moves to the day after the one you trained, and wraps", () => {
    const { nextAfter } = gymMod;
    expect(nextAfter(split, "Chest", 0)).toBe(1);
    expect(nextAfter(split, "Shoulders & Triceps", 3)).toBe(0);
    // Did legs instead of chest: next is shoulders & triceps.
    expect(nextAfter(split, "Legs", 0)).toBe(3);
    expect(nextAfter(split, null, 2)).toBe(2);
  });
});

describe("1-rep max only from real strength sets", () => {
  it("no estimate past 15 reps", () => {
    expect(oneRepMax(50, 170)).toBe(0);
    expect(oneRepMax(135, 15)).toBe(203);
    expect(bestByExercise([{ exerciseId: "c", weightLb: 50, reps: 170 }]).has("c")).toBe(false);
  });
});
