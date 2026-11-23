/**
 * Generated sweep: every way of starting a sentence × every thing Ethan says ×
 * every way of saying when, in both orders. Thousands of sentences, each
 * checked for the right kind, day, time and a clean title.
 * (The mic is the main way in, so it has to be right every time.)
 */
import { describe, expect, it } from "vitest";
import { parseMany } from "./multi";
import type { ParseContext } from "./index";
import { readWorkout } from "../gym-speech";
import { EXERCISE_LIBRARY } from "../exercise-library";

// Monday Nov 23, 2026, 10 AM in Phoenix.
const ctx: ParseContext = {
  now: new Date("2026-11-23T17:00:00Z"),
  timeZone: "America/Phoenix",
  spoken: true,
  classes: [
    { id: "h", name: "World History", shortNames: ["history"] },
    { id: "m", name: "College Algebra", shortNames: ["math", "algebra"] },
    { id: "a", name: "Human Anatomy", shortNames: ["anatomy"] },
  ],
  habits: ["Read", "Drink water", "Stretch"],
};

const OPENERS = ["", "okay so ", "yo ", "um ", "remind me to ", "i need to ", "ugh i forgot to ", "real quick "];

/** What's said, what it is, words the title must keep, the class, and work or not. */
const THINGS: { said: string; type: string; keep: string[]; cls?: string; area?: string }[] = [
  { said: "finish the history essay", type: "homework", keep: ["finish", "essay"], cls: "World History" },
  { said: "study for the algebra quiz", type: "homework", keep: ["study", "quiz"], cls: "College Algebra" },
  { said: "turn in the anatomy lab report", type: "homework", keep: ["turn in", "lab report"], cls: "Human Anatomy" },
  { said: "text mike about the garcia file", type: "task", keep: ["text mike", "garcia file"], area: "work" },
  { said: "send the loan estimate to the hendersons", type: "task", keep: ["send", "loan estimate", "hendersons"], area: "work" },
  { said: "call the dentist", type: "task", keep: ["call", "dentist"], area: "personal" },
  { said: "pick up protein powder at costco", type: "task", keep: ["pick up", "protein powder", "costco"], area: "personal" },
  { said: "email mrs johnson about the retake", type: "task", keep: ["email", "mrs johnson", "retake"] },
  { said: "clean my room", type: "task", keep: ["clean", "room"], area: "personal" },
  { said: "pay my phone bill", type: "task", keep: ["pay", "phone bill"], area: "personal" },
];

/** How "when" is said, and what it means (Mon Nov 23, 10 AM). */
const WHENS: { said: string; date: string | null; time?: [number, number] }[] = [
  { said: "", date: null },
  { said: "tomorrow", date: "2026-11-24" },
  { said: "friday", date: "2026-11-27" },
  { said: "on friday at 3", date: "2026-11-27", time: [15, 0] },
  { said: "tonight at 7", date: "2026-11-23", time: [19, 0] },
  { said: "by thursday", date: "2026-11-26" },
  { said: "wednesday at 2:30", date: "2026-11-25", time: [14, 30] },
  // The upcoming Tuesday, flagged on the review screen as "might mean the week after" (parser.test.ts).
  { said: "next tuesday", date: "2026-11-24" },
  { said: "on the 4th", date: "2026-12-04" },
  { said: "this weekend", date: "2026-11-28" },
];

const cases: [string, (typeof THINGS)[number], (typeof WHENS)[number]][] = [];
for (const o of OPENERS)
  for (const t of THINGS)
    for (const w of WHENS) {
      cases.push([`${o}${t.said}${w.said ? ` ${w.said}` : ""}`, t, w]);
      // Saying the day first ("tomorrow text mike…"); only without an opener, like people do.
      if (!o && w.said && !/^(?:by|on) /.test(w.said)) cases.push([`${w.said} ${t.said}`, t, w]);
    }

describe(`generated sweep: ${cases.length} sentences`, () => {
  it.each(cases)("%s", (said, thing, when) => {
    const all = parseMany(said, ctx);
    expect(all, "one item, not split up").toHaveLength(1);
    const d = all[0].draft;
    expect(d.type).toBe(thing.type);
    if (thing.cls) expect(d.className).toBe(thing.cls);
    if (thing.area) expect(d.area).toBe(thing.area);
    expect(d.when?.date ?? null).toBe(when.date);
    if (when.time) expect(d.when?.time).toEqual({ hour: when.time[0], minute: when.time[1] });
    else if (when.date) expect(d.when?.time ?? null).toBeNull();
    const title = d.title.toLowerCase();
    // The class name can move from the title to the class label ("history essay" → "Essay").
    for (const k of thing.keep) expect(title).toContain(k);
    expect(title, "no warm-up words").not.toMatch(/^(?:okay|so|yo|um|remind|i need|ugh|i forgot|real quick)\b/);
    expect(title, "no day words").not.toMatch(/\b(?:tomorrow|tonight|friday|thursday|wednesday|tuesday|weekend)\b/);
    expect(d.title.charAt(0)).toBe(d.title.charAt(0).toUpperCase());
  });
});

// ── Gym: every exercise × every way of saying the numbers ─────────────────
const EX = EXERCISE_LIBRARY.map((e) => ({ id: e.name, name: e.name, muscle: e.muscle, bodyweight: e.bodyweight }));
const LIFTS: [string, string][] = [
  ["bench", "Bench press"],
  ["squats", "Squat"],
  ["rdls", "Romanian deadlift"],
  ["lat pulldown", "Lat pulldown"],
  ["hammer curls", "Hammer curl"],
  ["skull crushers", "Skull crushers"],
  ["leg press", "Leg press"],
  ["incline dumbbell press", "Incline dumbbell press"],
  ["cable flys", "Cable fly"],
  ["barbell rows", "Barbell row"],
];
const FORMATS = [
  "{ex} {s}x{r} at {w}",
  "{ex} {s} sets of {r} at {w}",
  "{ex} {s} by {r} at {w}",
  "did {ex} {s} sets of {r} with {w}",
  "{ex} {w} for {r} {s} sets",
  "{ex} {s} sets of {r} at {w} pounds",
];
const NUMBERS: [number, number, number][] = [
  [3, 10, 135],
  [4, 8, 185],
  [5, 5, 225],
  [3, 12, 60],
];
const lifts: [string, string, number, number, number][] = [];
for (const [ex, name] of LIFTS)
  for (const f of FORMATS)
    for (const [s, r, w] of NUMBERS) lifts.push([f.replace("{ex}", ex).replace("{s}", String(s)).replace("{r}", String(r)).replace("{w}", String(w)), name, s, r, w]);

describe(`generated gym sweep: ${lifts.length} sentences`, () => {
  it.each(lifts)("%s", (said, name, s, r, w) => {
    const entries = readWorkout(said, EX).entries;
    expect(entries.map((e) => e.name)).toEqual([name]);
    expect(entries[0].sets).toHaveLength(s);
    for (const set of entries[0].sets) expect([set.reps, set.weightLb]).toEqual([r, w]);
    const d = parseMany(said, ctx);
    expect(d).toHaveLength(1);
    expect(d[0].draft.type).toBe("workout");
    expect(d[0].draft.when?.time ?? null, "gym numbers aren't a time").toBeNull();
  });
});

// ── Money and food: every phrasing × amounts ──────────────────────────────
const MONEY: [string, number][] = [];
for (const f of ["spent {n} on {x}", "paid {n} for {x}", "spent {n} dollars on {x}", "{x} cost me {n}", "bought {x} for {n}"])
  for (const n of [6, 14.5, 89.99, 120])
    for (const x of ["gas", "lunch", "a phone case", "chipotle"]) MONEY.push([f.replace("{n}", String(n)).replace("{x}", x), n]);

describe(`generated money sweep: ${MONEY.length} sentences`, () => {
  it.each(MONEY)("%s", (said, n) => {
    const d = parseMany(said, ctx);
    expect(d).toHaveLength(1);
    expect(d[0].draft).toMatchObject({ type: "expense", amount: n });
    expect(d[0].draft.when?.time ?? null).toBeNull();
  });
});

const FOOD: [string, number][] = [];
for (const f of ["ate {x} {c} calories", "had {x} about {c} calories", "ate {x} like {c} cals", "{x} {c} calories", "just ate {x} it was {c} calories"])
  for (const x of ["a chipotle bowl", "2 eggs and toast", "a protein bar", "a turkey sandwich"])
    for (const c of [250, 900]) FOOD.push([f.replace("{x}", x).replace("{c}", String(c)), c]);

describe(`generated food sweep: ${FOOD.length} sentences`, () => {
  it.each(FOOD)("%s", (said, c) => {
    const d = parseMany(said, ctx);
    expect(d).toHaveLength(1);
    expect(d[0].draft).toMatchObject({ type: "food", calories: c });
  });
});

// ── Correcting yourself: every marker × every kind of number ──────────────
const MARKERS = ["no wait", "sorry", "i mean", "excuse me", "make that", "no i mean", "my bad", "oops"];
const FIXES: { said: string; name: string; sets: number; reps: number; lb: number }[] = [
  { said: "bench 185 for 8 {m} 6", name: "Bench press", sets: 1, reps: 6, lb: 185 },
  { said: "squat 3 sets of 5 at 225 {m} 235", name: "Squat", sets: 3, reps: 5, lb: 235 },
  { said: "curls 3 sets of 12 with 30s {m} 35s", name: "Bicep curl", sets: 3, reps: 12, lb: 35 },
  { said: "lat pulldown 4 by 10 at 120 {m} 130", name: "Lat pulldown", sets: 4, reps: 10, lb: 130 },
  { said: "leg press 400 for 12 {m} 15", name: "Leg press", sets: 1, reps: 15, lb: 400 },
];
const fixes: [string, string, number, number, number][] = [];
for (const m of MARKERS) for (const f of FIXES) fixes.push([f.said.replace("{m}", m), f.name, f.sets, f.reps, f.lb]);

describe(`generated self-correction sweep: ${fixes.length} sentences`, () => {
  it.each(fixes)("%s", (said, name, s, r, lb) => {
    const e = readWorkout(said, EX).entries;
    expect(e.map((x) => x.name)).toEqual([name]);
    expect(e[0].sets).toHaveLength(s);
    for (const set of e[0].sets) expect([set.reps, set.weightLb]).toEqual([r, lb]);
  });
});
