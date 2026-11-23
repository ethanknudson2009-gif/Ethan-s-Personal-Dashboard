/**
 * Phrases from a "talk to it like a real teenager" stress test.
 * Each one was wrong once; these keep them fixed.
 */
import { describe, expect, it } from "vitest";
import { parseMany } from "./multi";
import type { ParseContext } from "./index";
import { readWorkout } from "../gym-speech";
import { changeLabel, planFix, readFix } from "../gym-fix";
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

  it("cardio is time and distance, not a lift", () => {
    expect(one("ran a mile in 8 minutes")).toMatchObject({ type: "workout", title: "Run", distanceMiles: 1, minutes: 8, sets: null });
    expect(one("did 30 minutes on the stairmaster")).toMatchObject({ type: "workout", minutes: 30, sets: null });
  });

  it("drank water checks off the habit", () => {
    expect(one("drank water")).toMatchObject({ type: "habit" });
  });
});

describe("fixing a past workout", () => {
  const three = [
    { id: "a", weightLb: 185, reps: 8 },
    { id: "b", weightLb: 185, reps: 8 },
    { id: "c", weightLb: 185, reps: 6 },
  ];

  it("'4 sets not 3' adds a copy of the last set (never touches reps)", () => {
    const f = readFix("on my last chest day I actually did 4 sets not 3 on bench", EX);
    expect(f).toMatchObject({ exercise: "Bench press", field: "sets", to: 4 });
    const plan = planFix(f!, three);
    expect(plan).toEqual([{ setId: "c", n: 4, field: "add", before: null, after: 0, copy: { reps: 6, weightLb: 185 } }]);
    expect(changeLabel(plan[0])).toBe("Set 4: add (6 reps @ 185 lb)");
  });

  it("'2 sets not 3' removes the last set", () => {
    const f = readFix("yesterday I only did 2 sets not 3 of bench", EX);
    expect(f).toMatchObject({ field: "sets", to: 2 });
    const plan = planFix(f!, three);
    expect(plan.map((c) => [c.setId, c.field])).toEqual([["c", "remove"]]);
    expect(changeLabel(plan[0])).toBe("Set 3: remove (6 reps @ 185 lb)");
  });

  it.each([
    ["on my last chest day I only did 2 sets of bench not 3", "Bench press", 2],
    ["last leg day I did 5 sets of squats not 4", "Squat", 5],
    ["yesterday bench was 2 sets not 3", "Bench press", 2],
  ])("%s → a set-count fix", (said, exercise, to) => {
    expect(readFix(said, EX)).toMatchObject({ exercise, field: "sets", to });
  });

  it("already the right number of sets → nothing to change", () => {
    const f = readFix("on my last chest day I did 3 sets not 4 on bench", EX)!;
    expect(planFix(f, three)).toEqual([]);
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

  it("the due time counts even when the day came first", () => {
    expect(one("okay so tomorrow I have a history essay due at 11:59 and I need to start it tonight")).toMatchObject({
      type: "homework",
      className: "World History",
      when: { date: "2026-11-24", time: { hour: 23, minute: 59 } },
    });
  });

  it("the SAT is a test, not Saturday", () => {
    const d = one("study for the SAT every saturday morning");
    expect(d.title).toBe("Study for the SAT");
    expect(d.when?.date).toBe("2026-11-28");
    expect(one("practice sat 9").when).toMatchObject({ date: "2026-11-28", time: { hour: 9 } });
  });

  it("Mike said the file needs something", () => {
    expect(one("mike said the Johnson file needs a VOE by end of day")).toMatchObject({
      title: "Get a VOE for the Johnson file",
      area: "work",
      when: { date: "2026-11-23", time: { hour: 17 } },
    });
  });

  it("a goal isn't a set you did", () => {
    expect(one("I want to hit 200 on bench by summer").type).not.toBe("workout");
    expect(one("hit 200 on bench today").type).toBe("workout");
  });

  it("'before 3 sets' still isn't a time", () => {
    expect(one("do pushups before 3 sets of squats").when?.time ?? null).toBeNull();
  });
});

describe("stress batch 3: how people actually talk", () => {
  it.each([
    ["yo remind me to submit the anatomy lab report tonight", { type: "homework", title: "Submit the anatomy lab report" }],
    ["ugh I forgot to do my algebra homework it's due first period tomorrow", { type: "homework", title: "Do my homework", when: { date: "2026-11-24" } }],
    ["test in history on the 4th chapters 10 through 12", { type: "homework", className: "World History", when: { date: "2026-12-04" } }],
    ["mike needs the Thompson pre approval updated asap", { title: "Update the Thompson pre approval asap", area: "work" }],
    ["the appraisal for the Lee purchase came in low tell mike", { title: "Tell Mike the appraisal for the Lee purchase came in low", area: "work" }],
    ["venmo jake 20 for pizza", { type: "expense", amount: 20 }],
    ["chick fil a sandwich and fries about 800 calories", { type: "food", title: "Chick-fil-A sandwich and fries", calories: 800 }],
    ["2 scrambled eggs and a banana", { type: "food" }],
    ["I want to hit 200 on bench by summer", { title: "Hit 200 on bench by summer" }],
  ])("%s", (said, want) => expect(one(said)).toMatchObject(want));

  it("practice, then a work shift: two things", () => {
    const all = parseMany("I have practice after school until 5 then work from 6 to 9", ctx).map((x) => x.draft);
    expect(all.map((d) => d.title)).toEqual(["Practice after school until 5", "Work shift from 6 to 9"]);
    expect(all[1].area).toBe("work");
  });

  it.each([
    ["ab circuit crunches 3 by 25 leg raises 3 by 15 russian twists 3 by 30", ["Crunches", "Hanging leg raise", "Russian twists"]],
    ["shoulder press 135 for 6 no I mean 8", ["Dumbbell shoulder press"]],
    ["swam 20 laps", ["Swimming"]],
    ["hit a PR on bench today", ["Bench press"]],
    ["new PR on squat 275", ["Squat"]],
  ])("%s → only real exercises", (said, names) => {
    const all = sets(said);
    expect(all.map((e) => e.name)).toEqual(names);
    expect(all.every((e) => e.known)).toBe(true);
  });

  it("'no I mean 8' fixes the reps", () => {
    expect(sets("shoulder press 135 for 6 no I mean 8")[0].sets).toEqual([[8, 135]]);
  });
});

describe("leftovers from batch 3", () => {
  it("'monday morning' said on Monday at 10 AM means next Monday", () => {
    expect(one("send the closing disclosure for the Brown loan monday morning").when?.date).toBe("2026-11-30");
    expect(one("monday call the bank").when?.date).toBe("2026-11-23");
  });

  it("a day and time said first stays with the thing", () => {
    expect(one("monday at 3 call the bank")).toMatchObject({ title: "Call the bank", when: { date: "2026-11-23", time: { hour: 15 } } });
  });

  it("friends' names get capitals, family words and things don't", () => {
    expect(one("venmo jake 20 for pizza").title).toBe("Venmo Jake for pizza");
    expect(one("text sarah about the project").title).toBe("Text Sarah about the project");
    expect(one("call mom").title).toBe("Call mom");
    expect(one("pick up prescription").title).toBe("Pick up prescription");
  });

  it("'my essay is about…' keeps what it's about", () => {
    expect(one("my history essay is about the civil war due friday")).toMatchObject({ title: "Essay about the civil war", className: "World History" });
  });
});
