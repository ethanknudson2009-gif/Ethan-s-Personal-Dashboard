import { describe, expect, it } from "vitest";
import { chartableExercises, splitCounts, strengthSeries, weekStart, weeklyVolume, type PastWorkout } from "./gym-progress";

const w = (date: string, day: string | null, sets: [string, number, number][], skipped = false): PastWorkout => ({
  date,
  day,
  skipped,
  sets: sets.map(([exerciseId, weightLb, reps]) => ({ exerciseId, weightLb, reps, done: true })),
});

const history: PastWorkout[] = [
  w("2026-11-18", "Chest", [["bench", 145, 8], ["bench", 155, 5], ["fly", 30, 12]]),
  w("2026-11-02", "Chest", [["bench", 135, 10], ["bench", 135, 8]]),
  w("2026-11-10", "Legs", [["squat", 185, 5]]),
  w("2026-11-11", "Shoulders & Triceps", [], true),
  w("2026-11-16", "Back & Biceps", [["row", 100, 10]]),
];

describe("gym progress", () => {
  it("strength: best set per workout, oldest first", () => {
    expect(strengthSeries(history, "bench")).toEqual([
      { date: "2026-11-02", e1rm: 180, weightLb: 135, reps: 10 },
      { date: "2026-11-18", e1rm: 184, weightLb: 145, reps: 8 },
    ]);
    expect(strengthSeries(history, "nope")).toEqual([]);
  });

  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-19")).toBe("2026-11-16"); // Thu → Mon
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Mon
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sun belongs to the week before
  });

  it("weekly volume includes empty weeks and leaves out skipped days", () => {
    const weeks = weeklyVolume(history, "2026-11-19", 4);
    expect(weeks.map((x) => x.weekStart)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(weeks.map((x) => x.workouts)).toEqual([0, 1, 1, 2]);
    expect(weeks[1].volume).toBe(135 * 10 + 135 * 8);
    expect(weeks[3].volume).toBe(145 * 8 + 155 * 5 + 30 * 12 + 100 * 10);
  });

  it("split balance counts trained and skipped days", () => {
    expect(splitCounts(history, ["Chest", "Back & Biceps", "Legs", "Shoulders & Triceps"], "2026-11-05")).toEqual([
      { day: "Chest", count: 1, skipped: 0 },
      { day: "Back & Biceps", count: 1, skipped: 0 },
      { day: "Legs", count: 1, skipped: 0 },
      { day: "Shoulders & Triceps", count: 0, skipped: 1 },
    ]);
  });

  it("chart picker lists the most-trained exercises first", () => {
    expect(chartableExercises(history)).toEqual([
      { exerciseId: "bench", sessions: 2 },
      { exerciseId: "fly", sessions: 1 },
      { exerciseId: "squat", sessions: 1 },
      { exerciseId: "row", sessions: 1 },
    ]);
  });
});
