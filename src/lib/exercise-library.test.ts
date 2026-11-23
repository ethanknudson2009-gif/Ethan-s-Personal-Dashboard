import { describe, expect, it } from "vitest";
import { detailOf, EXERCISE_LIBRARY, groupOf, libraryEntry, MUSCLE_TREE, plain, searchScore } from "./exercise-library";

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

describe("muscles as a tree (group → part)", () => {
  it.each([
    ["Incline dumbbell press", "chest", "upper chest"],
    ["Decline bench press", "chest", "lower chest"],
    ["Bench press", "chest", "mid chest"],
    ["Lat pulldown", "back", "lats"],
    ["Barbell row", "back", "upper back"],
    ["Barbell shrug", "back", "traps"],
    ["Deadlift", "back", "lower back"],
    ["Neck curl", "back", "neck"],
    ["Lateral raise", "shoulders", "side delts"],
    ["Reverse pec deck", "shoulders", "rear delts"],
    ["Overhead press", "shoulders", "front delts"],
    ["Hammer curl", "biceps", "biceps"],
    ["Skull crushers", "triceps", "triceps"],
    ["Wrist curl", "forearms", "forearms"],
    ["Leg extension", "legs", "quads"],
    ["Seated leg curl", "legs", "hamstrings"],
    ["Romanian deadlift", "legs", "hamstrings"],
    ["Seated calf raise", "legs", "calves"],
    ["Hip thrust", "glutes", "glutes"],
    ["Sumo deadlift", "legs", "glutes"],
    ["Hip adduction", "glutes", "inner & outer thigh"],
    ["Russian twists", "core", "obliques"],
    ["Hanging leg raise", "core", "abs"],
  ])("%s → %s → %s", (name, muscle, part) => expect(detailOf(name, muscle)).toBe(part));

  it("every library exercise lands in exactly one group of the tree", () => {
    for (const e of EXERCISE_LIBRARY) {
      const part = detailOf(e.name, e.muscle);
      expect(MUSCLE_TREE.filter((g) => g.parts.includes(part)), e.name).toHaveLength(1);
    }
  });

  it("biceps, triceps and forearms sit under Arms; shoulders is its own group", () => {
    expect(groupOf("biceps").label).toBe("Arms");
    expect(groupOf("triceps").label).toBe("Arms");
    expect(groupOf("forearms").label).toBe("Arms");
    expect(groupOf("side delts").label).toBe("Shoulders");
    expect(groupOf("calves").label).toBe("Legs");
  });

  it("no name or nickname points at two different exercises", () => {
    const seen = new Map<string, string>();
    for (const e of EXERCISE_LIBRARY) {
      for (const a of [e.name, ...e.aliases]) {
        const k = plain(a);
        if (seen.has(k)) expect(seen.get(k), k).toBe(e.name);
        seen.set(k, e.name);
      }
    }
  });
});
