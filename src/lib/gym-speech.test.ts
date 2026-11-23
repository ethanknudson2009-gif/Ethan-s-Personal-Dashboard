import { describe, expect, it } from "vitest";
import { dayForMuscles, gymNumbers, readWorkout, setsSummary, workoutNote, type GymExercise } from "./gym-speech";
import { EXERCISE_LIBRARY } from "./exercise-library";

// The built-in list from migration 0013 (ids = names, to keep tests readable).
const LIST: [string, string][] = [
  ["Bench press", "chest"], ["Incline dumbbell press", "chest"], ["Push-ups", "chest"], ["Chest fly", "chest"],
  ["Squat", "legs"], ["Leg press", "legs"], ["Romanian deadlift", "legs"], ["Lunges", "legs"], ["Leg curl", "legs"],
  ["Leg extension", "legs"], ["Calf raise", "legs"], ["Deadlift", "back"], ["Pull-ups", "back"], ["Lat pulldown", "back"],
  ["Barbell row", "back"], ["Seated cable row", "back"], ["Overhead press", "shoulders"], ["Lateral raise", "shoulders"],
  ["Rear delt fly", "shoulders"], ["Bicep curl", "arms"], ["Hammer curl", "arms"], ["Tricep pushdown", "arms"],
  ["Skull crushers", "arms"], ["Dips", "arms"], ["Plank (seconds)", "core"], ["Crunches", "core"], ["Hanging leg raise", "core"],
];
const BODYWEIGHT = new Set(["Push-ups", "Pull-ups", "Dips", "Plank (seconds)", "Crunches", "Hanging leg raise"]);
const EX: GymExercise[] = LIST.map(([name, muscle]) => ({ id: name, name, muscle, bodyweight: BODYWEIGHT.has(name) }));
const read = (t: string) => readWorkout(t, EX);
/** Compact view: "Bench press: 3×10 @ 135 lb | …" */
const summary = (t: string) =>
  read(t)
    .entries.map((e) => `${e.name}: ${setsSummary(e.sets)}`)
    .join(" | ");

describe("spoken numbers, gym style", () => {
  it.each([
    ["one thirty five", "135"],
    ["two twenty five", "225"],
    ["one forty", "140"],
    ["a hundred and eighty five", "185"],
    ["one hundred thirty five", "135"],
    ["forty five", "45"],
    ["three by ten", "3 by 10"],
    ["1:35", "135"],
    ["2:25 for 5", "225 for 5"],
    ["3x10", "3 x 10"],
    ["135lbs", "135 lbs"],
    ["twenty", "20"],
  ])("%s → %s", (said, out) => {
    expect(gymNumbers(said)).toBe(out);
  });
});

describe("one exercise, said every way", () => {
  const bench = "Bench press: 3×10 @ 135 lb";
  it.each([
    "bench 3x10 at 135",
    "bench press 3 x 10 @ 135",
    "135 bench 3x10",
    "bench 135 3x10",
    "bench 3x10 135",
    "3x10 bench at 135",
    "3 sets of 10 on bench at 135",
    "did 3 sets of 10 reps on bench press at 135 pounds",
    "bench 135 for 3 sets of 10",
    "bench 135 for 10 reps 3 sets",
    "bench 10 reps 3 sets 135",
    "135 pounds bench press three sets of ten",
    "bench three by ten at one thirty five",
    "bench press for 3 sets of 10 at 135 lbs",
    "I did bench, 3 sets of 10 at 135",
    "bench 135 x 10 x 3",
    "bench 3x10x135",
    "flat bench 3x10 @135lbs",
    "Bench 3 sets 10 reps at 135.",
  ])("%s", (said) => {
    expect(summary(said)).toBe(bench);
  });
});

describe("different weights per set", () => {
  it.each([
    ["bench 135 for 10, 155 for 8, 175 for 6", "Bench press: 135×10, 155×8, 175×6"],
    ["bench 135x10, 155x8, 175x6", "Bench press: 135×10, 155×8, 175×6"],
    ["bench 135 for 10 then 155 for 8 then 175 for 6", "Bench press: 135×10, 155×8, 175×6"],
    ["squat 225 for 5, 5, 5", "Squat: 3×5 @ 225 lb"],
    ["squats 225 for 5, 245 for 3", "Squat: 225×5, 245×3"],
  ])("%s", (said, out) => {
    expect(summary(said)).toBe(out);
  });
});

describe("whole workouts in one breath", () => {
  it("chest day with commas", () => {
    const w = read("chest day, bench 3x10 at 135, incline dumbbell 3 sets of 8 at 50, flys 3x12 at 30 and pushups 2 sets of 20");
    expect(w.day).toBe("Chest");
    expect(w.entries.map((e) => `${e.name}: ${setsSummary(e.sets)}`)).toEqual([
      "Bench press: 3×10 @ 135 lb",
      "Incline dumbbell press: 3×8 @ 50 lb",
      "Chest fly: 3×12 @ 30 lb",
      "Push-ups: 2×20",
    ]);
  });

  it("no commas at all (how speech often comes out)", () => {
    expect(summary("bench 3x10 at 135 incline 3x8 at 50 flys 3x12 at 30")).toBe(
      "Bench press: 3×10 @ 135 lb | Incline dumbbell press: 3×8 @ 50 lb | Chest fly: 3×12 @ 30 lb",
    );
  });

  it("weights first, no commas", () => {
    expect(summary("135 bench 3x10 then 50 incline 3x8")).toBe("Bench press: 3×10 @ 135 lb | Incline dumbbell press: 3×8 @ 50 lb");
  });

  it("back and biceps, spoken numbers and 'then'", () => {
    const w = read(
      "today was back and biceps, lat pulldown three sets of ten at one twenty then barbell rows 4x8 at 115 then pull ups 3 sets to failure and hammer curls 3x12 with 30s",
    );
    expect(w.day).toBe("Back & Biceps");
    expect(w.entries.map((e) => `${e.name}: ${setsSummary(e.sets)}`)).toEqual([
      "Lat pulldown: 3×10 @ 120 lb",
      "Barbell row: 4×8 @ 115 lb",
      "Pull-ups: 3×max",
      "Hammer curl: 3×12 @ 30 lb",
    ]);
  });

  it("legs, mixed orders", () => {
    const w = read("leg day. squats 225 for 5 sets of 5. 3 sets of 10 leg press at 270. leg curls 3x12 at 90. calf raises 4x15");
    expect(w.day).toBe("Legs");
    expect(w.entries.map((e) => `${e.name}: ${setsSummary(e.sets)}`)).toEqual([
      "Squat: 5×5 @ 225 lb",
      "Leg press: 3×10 @ 270 lb",
      "Leg curl: 3×12 @ 90 lb",
      "Calf raise: 4×15",
    ]);
  });

  it("shoulders and triceps, day said at the end", () => {
    const w = read("overhead press 3x8 at 95, lateral raises 3x15 at 20, tricep pushdowns 3x12 at 50, skull crushers 3x10 at 40, shoulders and triceps");
    expect(w.day).toBe("Shoulders & Triceps");
    expect(w.entries.map((e) => e.name)).toEqual(["Overhead press", "Lateral raise", "Tricep pushdown", "Skull crushers"]);
  });

  it("the day comes from the exercises when not said", () => {
    expect(read("bench 3x10 at 135, incline 3x8 at 50").day).toBe("Chest");
    expect(read("tricep pushdown 3x12 at 50, lateral raise 3x15 at 20").day).toBe("Shoulders & Triceps");
    expect(read("bicep curls 3x10 at 30, rows 3x10 at 135").day).toBe("Back & Biceps");
  });

  it("an exercise we don't know is kept with your words", () => {
    const w = read("preacher curls 3x10 at 60 and cable crossovers 3x15 at 25");
    expect(w.entries.map((e) => `${e.name}: ${setsSummary(e.sets)}`)).toEqual(["Preacher curls: 3×10 @ 60 lb", "Cable crossovers: 3×15 @ 25 lb"]);
    expect(w.entries.every((e) => e.exerciseId === null)).toBe(true);
  });

  it("kilos are turned into pounds", () => {
    expect(summary("bench 3x5 at 100 kg")).toBe("Bench press: 3×5 @ 220 lb");
  });

  it("just the muscles, no numbers", () => {
    const w = read("hit chest today");
    expect(w).toMatchObject({ day: "Chest", entries: [] });
    expect(read("did back and biceps").day).toBe("Back & Biceps");
    expect(read("legs").day).toBe("Legs");
  });

  it("skip", () => {
    expect(read("skip chest day").skip).toBe(true);
    expect(read("rest day today").skip).toBe(true);
    expect(read("bench 3x10 at 135").skip).toBe(false);
  });
});

describe("the standard note", () => {
  it("reads cleanly", () => {
    const w = read("chest day bench 135 for 10, 155 for 8 and pushups 2x20");
    expect(workoutNote(w)).toBe("Chest day\n• Bench press: 135×10, 155×8\n• Push-ups: 2×20");
  });

  it("matches split days", () => {
    expect(dayForMuscles(["back", "biceps"])).toBe("Back & Biceps");
    expect(dayForMuscles(["triceps"])).toBe("Shoulders & Triceps");
    expect(dayForMuscles([])).toBeNull();
  });
});

describe("round 2: messy real-world speech", () => {
  it.each([
    ["Bench press three sets of 10 at 135 lb", "Bench press: 3×10 @ 135 lb"],
    ["I did three sets of bench at 135 for 10", "Bench press: 3×10 @ 135 lb"],
    ["bench at 135 for three sets of ten", "Bench press: 3×10 @ 135 lb"],
    ["benched 135 for 3 sets of 10", "Bench press: 3×10 @ 135 lb"],
    ["dumbbell curls 3x10 with 25s", "Bicep curl: 3×10 @ 25 lb"],
    ["3 sets of 12 tricep pushdowns at 50", "Tricep pushdown: 3×12 @ 50 lb"],
    ["pull-ups 3 sets of 8", "Pull-ups: 3×8"],
    ["pullups 8 7 6", "Pull-ups: BW×8, BW×7, BW×6"],
    ["dips bodyweight 3x10", "Dips: 3×10"],
    ["deadlift 315 for 1", "Deadlift: 1×1 @ 315 lb"],
    ["deadlifts three fifteen for five", "Deadlift: 1×5 @ 315 lb"],
    ["squat 3 sets of 5 at 225 and leg press 4 sets of 12 at 300", "Squat: 3×5 @ 225 lb | Leg press: 4×12 @ 300 lb"],
    ["Overhead press 95 pounds 3 sets 8 reps", "Overhead press: 3×8 @ 95 lb"],
    ["lateral raises 20s 3x15", "Lateral raise: 3×15 @ 20 lb"],
    ["did 20 pushups", "Push-ups: 1×20"],
    ["RDLs 3x8 at 185", "Romanian deadlift: 3×8 @ 185 lb"],
    ["lat pull downs 3 by 12 at 100", "Lat pulldown: 3×12 @ 100 lb"],
    ["seated rows 3x10 at 120", "Seated cable row: 3×10 @ 120 lb"],
    ["Incline DB press 3x10 at 55s", "Incline dumbbell press: 3×10 @ 55 lb"],
    ["leg extensions 3x15 at 110 and leg curls 3x15 at 90", "Leg extension: 3×15 @ 110 lb | Leg curl: 3×15 @ 90 lb"],
    ["hammer curls 3 sets of 10 at 30 each", "Hammer curl: 3×10 @ 30 lb"],
    ["skullcrushers 3x10 at 60", "Skull crushers: 3×10 @ 60 lb"],
    ["calf raises 4 sets of 20 at 200", "Calf raise: 4×20 @ 200 lb"],
  ])("%s", (said, out) => {
    expect(summary(said)).toBe(out);
  });

  it("a full back day said like a person talks", () => {
    const w = read(
      "Okay so today was back and bis. Started with deadlifts 225 for 5 then 275 for 3 then 315 for 1. Then lat pulldowns three sets of twelve at 120. Barbell rows four by eight at 135. Finished with hammer curls 3x12 with 30s and bicep curls 3 sets of 10 at 25",
    );
    expect(w.day).toBe("Back & Biceps");
    expect(w.entries.map((e) => `${e.name}: ${setsSummary(e.sets)}`)).toEqual([
      "Deadlift: 225×5, 275×3, 315×1",
      "Lat pulldown: 3×12 @ 120 lb",
      "Barbell row: 4×8 @ 135 lb",
      "Hammer curl: 3×12 @ 30 lb",
      "Bicep curl: 3×10 @ 25 lb",
    ]);
  });

  it("the same workout in a different order gives the same note", () => {
    const a = workoutNote(read("chest day: bench 3x10 at 135, flys 3x12 at 30"));
    const b = workoutNote(read("135 on bench for 3 sets of 10, then 3 sets of 12 flys at 30, chest"));
    expect(b).toBe(a);
  });
});

describe("the exercise library's nicknames", () => {
  // A few library exercises as the database would hand them over.
  const lib = [
    { id: "pd", name: "Pec deck", muscle: "chest" },
    { id: "rdl", name: "Romanian deadlift", muscle: "legs" },
    { id: "bss", name: "Bulgarian split squat", muscle: "legs" },
    { id: "ht", name: "Hip thrust", muscle: "glutes" },
    { id: "fp", name: "Face pull", muscle: "back" },
    { id: "pr", name: "EZ-bar preacher curl", muscle: "biceps" },
    { id: "sk", name: "Skull crushers", muscle: "triceps" },
    { id: "cgb", name: "Close-grip bench press", muscle: "chest" },
  ];
  it.each([
    ["pec dec 3x12 at 100", "pd"],
    ["rdls 3 sets of 8 at 185", "rdl"],
    ["bulgarians 3x10 at 40", "bss"],
    ["hip thrusts 4x10 at 225", "ht"],
    ["facepulls 3x15 at 40", "fp"],
    ["preachers 3x10 at 60", "pr"],
    ["skullcrushers 3x10 at 50", "sk"],
    ["close grip bench 3x8 at 155", "cgb"],
  ])("%s", (said, id) => {
    const w = readWorkout(said, lib);
    expect(w.entries.map((e) => e.exerciseId)).toEqual([id]);
    expect(w.entries[0].sets.length).toBeGreaterThan(0);
  });
});

describe("gym slang", () => {
  it("plates: 3 plates on a bar is 315; 4 plates on the leg press is 360", () => {
    const w = read("squat 3 plates for 3 and leg press 4 plates for 12");
    expect(w.entries.map((e) => [e.name, e.sets[0]])).toEqual([
      ["Squat", { weightLb: 315, reps: 3 }],
      ["Leg press", { weightLb: 360, reps: 12 }],
    ]);
  });
  it("'pulled 315 for a PR' is a one-rep deadlift", () => {
    const w = read("pulled 315 for a PR");
    expect(w.entries[0].name).toBe("Deadlift");
    expect(w.entries[0].sets).toEqual([{ weightLb: 315, reps: 1 }]);
  });
  it("'benched 225 for 5 then 185 for 8'", () => {
    expect(read("benched 225 for 5 then 185 for 8").entries[0].sets).toEqual([
      { weightLb: 225, reps: 5 },
      { weightLb: 185, reps: 8 },
    ]);
  });
});

describe("sports and cardio from the library", () => {
  const LIB = EXERCISE_LIBRARY.map((e) => ({ id: e.name, name: e.name, muscle: e.muscle, bodyweight: e.bodyweight }));
  it.each([
    ["played basketball for an hour", "Basketball"],
    ["did yoga for 30 minutes", "Yoga"],
    ["went bouldering after school", "Rock climbing"],
    ["ran on the treadmill for 30 minutes", "Treadmill run"],
    ["did neck curls 3 sets of 15", "Neck curl"],
  ])("%s → %s", (said, name) => expect(readWorkout(said, LIB).entries.map((e) => e.name)).toEqual([name]));

  it("a neck curl is a back/neck move, not biceps", () => {
    expect(readWorkout("did neck curls 3 sets of 15", LIB).muscles).toEqual(["back"]);
  });
});
