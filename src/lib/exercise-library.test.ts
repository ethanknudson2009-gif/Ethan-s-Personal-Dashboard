import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, libraryEntry, plain, searchScore } from "./exercise-library";

describe("exercise library", () => {
  it("has hundreds of exercises, each named once", () => {
    expect(EXERCISE_LIBRARY.length).toBeGreaterThanOrEqual(380);
    const names = EXERCISE_LIBRARY.map((e) => plain(e.name));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it("no nickname points at two different exercises, or at another exercise's name", () => {
    const owner = new Map<string, string>();
    for (const e of EXERCISE_LIBRARY) owner.set(plain(e.name), e.name);
    const clashes: string[] = [];
    for (const e of EXERCISE_LIBRARY) {
      for (const a of e.aliases) {
        const k = plain(a);
        const was = owner.get(k);
        if (was && was !== e.name) clashes.push(`"${a}": ${was} / ${e.name}`);
        owner.set(k, e.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("keeps the original 27 starter names", () => {
    for (const n of ["Bench press", "Incline dumbbell press", "Push-ups", "Chest fly", "Squat", "Leg press", "Romanian deadlift", "Lunges", "Leg curl", "Leg extension", "Calf raise", "Deadlift", "Pull-ups", "Lat pulldown", "Barbell row", "Seated cable row", "Overhead press", "Lateral raise", "Rear delt fly", "Bicep curl", "Hammer curl", "Tricep pushdown", "Skull crushers", "Dips", "Plank (seconds)", "Crunches", "Hanging leg raise"]) {
      expect(libraryEntry(n), n).toBeDefined();
    }
  });

  it("search finds by name or nickname, best first", () => {
    const rank = (q: string) =>
      EXERCISE_LIBRARY.map((e) => ({ n: e.name, s: searchScore(q, e.name, e.aliases) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.n);
    expect(rank("bench")[0]).toBe("Bench press");
    expect(rank("rdl")[0]).toBe("Romanian deadlift");
    expect(rank("inc db")).toContain("Incline dumbbell press");
    expect(rank("pec deck")[0]).toBe("Pec deck");
    expect(rank("lat raise")[0]).toBe("Lateral raise");
    expect(rank("zzz")).toEqual([]);
  });
});
