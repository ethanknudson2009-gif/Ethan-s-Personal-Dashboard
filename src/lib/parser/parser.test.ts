import { describe, expect, it } from "vitest";
import { fromLocal, toLocalDate } from "@/lib/time";
import { parse, type ParseContext } from "./index";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);

// Ethan's real classes (docs/08-my-schedule.md).
const classes = [
  { id: "wh", name: "World History", shortNames: ["world history"] },
  { id: "choir", name: "Choir" },
  { id: "anat", name: "Human Anatomy", shortNames: ["anatomy", "anat"] },
  { id: "ai", name: "AI Mastermind", shortNames: ["ai"] },
  { id: "alg", name: "College Algebra", shortNames: ["algebra", "math"] },
  { id: "speech", name: "Speech" },
  { id: "cad", name: "AutoCAD", shortNames: ["cad", "autocad"] },
  { id: "ch", name: "Church History" },
];

// "Now" = Tuesday Nov 10, 2026, 4:00 PM in Phoenix.
const ctx: ParseContext = { now: at("2026-11-10", 16), timeZone: PHX, classes, habits: ["read", "stretch"] };
const p = (text: string, c: ParseContext = ctx) => parse(text, c);
const dueDay = (text: string, c: ParseContext = ctx) => {
  const w = p(text, c).when;
  return w ? toLocalDate(w.dueAt, PHX) : null;
};

describe("the examples from doc 07", () => {
  it("bio-style homework with a class nickname, weekday and time", () => {
    const d = p("anatomy lab due Fri 11:59pm");
    expect(d).toMatchObject({ type: "homework", title: "Lab", classId: "anat", confidence: 1, problems: [] });
    expect(d.when?.dueAt.toISOString()).toBe("2026-11-14T06:59:00.000Z"); // Fri 11:59 PM Phoenix
    expect(d.when?.hasTime).toBe(true);
  });

  it("food: ate 2 eggs", () => {
    const d = p("ate 2 eggs");
    expect(d).toMatchObject({ type: "food", title: "Eggs", quantity: 2 });
    expect(d.problems).toContain("Calories needed");
    expect(d.confidence).toBeLessThan(0.85);
  });

  it("expense: spent $12 gas", () => {
    expect(p("spent $12 gas")).toMatchObject({ type: "expense", amount: 12, category: "gas", title: "Gas", confidence: 1 });
  });

  it("homework due tomorrow with no time → end of day", () => {
    const d = p("math worksheet tomorrow");
    expect(d).toMatchObject({ type: "homework", classId: "alg", title: "Worksheet" });
    expect(d.when).toMatchObject({ date: "2026-11-11", hasTime: false });
    expect(d.when?.dueAt.toISOString()).toBe("2026-11-12T06:59:00.000Z"); // 11:59 PM local
  });

  it("a bare hour right after a day: call the bank sat 9", () => {
    const d = p("call the bank sat 9");
    expect(d.when?.dueAt.toISOString()).toBe(at("2026-11-14", 9).toISOString());
  });
});

describe("Ethan's classes", () => {
  it("the format Ethan wants: Speech: “What is Equal” Journal", () => {
    const d = p('speech "What is Equal" journal due thursday');
    expect(d).toMatchObject({ type: "homework", classId: "speech", title: '"What is Equal" journal' });
    expect(d.when?.date).toBe("2026-11-12");
  });

  it("full names, nicknames and starts-of-names all work", () => {
    expect(p("church history reading due wed").classId).toBe("ch");
    expect(p("world history essay due monday").classId).toBe("wh");
    expect(p("cad drawing due thurs").classId).toBe("cad");
    expect(p("algebra quiz wednesday").classId).toBe("alg");
    expect(p("choir practice log due monday").classId).toBe("choir");
    expect(p("ai mastermind project tues").classId).toBe("ai");
    expect(p("anat test in 2 weeks").classId).toBe("anat");
  });

  it("'history' alone is ambiguous between the two history classes, so it asks", () => {
    const d = p("history essay due fri");
    expect(d.classId).toBeNull();
    expect(d.problems.join(" ")).toMatch(/World History or Church History/);
    expect(d.confidence).toBeLessThan(0.85);
  });
});

describe("dates", () => {
  it("weekday names: upcoming one, and today only if the time hasn't passed", () => {
    expect(dueDay("algebra quiz fri")).toBe("2026-11-13");
    expect(dueDay("algebra quiz tues")).toBe("2026-11-10"); // today, no time given
    expect(dueDay("algebra quiz tues 9am")).toBe("2026-11-17"); // 9 AM already passed → next week
    expect(dueDay("algebra quiz tues 8pm")).toBe("2026-11-10");
  });

  it("'next friday' picks the upcoming Friday but flags that it might mean the week after", () => {
    const d = p("speech outline due next friday");
    expect(d.when?.date).toBe("2026-11-13");
    expect(d.problems.join(" ")).toMatch(/next fri/);
  });

  it("relative days and 'in N days/weeks'", () => {
    expect(dueDay("speech notes today")).toBe("2026-11-10");
    expect(dueDay("speech notes tmrw")).toBe("2026-11-11");
    expect(dueDay("algebra homework in 3 days")).toBe("2026-11-13");
    expect(dueDay("anatomy test in 2 weeks")).toBe("2026-11-24");
    expect(dueDay("spent $8 lunch yesterday")).toBe("2026-11-09");
  });

  it("calendar dates", () => {
    expect(dueDay("cad project due 11/20")).toBe("2026-11-20");
    expect(dueDay("cad project due 1/15")).toBe("2027-01-15"); // already past this year → next year
    expect(dueDay("cad project due 12/3/26")).toBe("2026-12-03");
    expect(dueDay("cad project due dec 3")).toBe("2026-12-03");
    expect(dueDay("cad project due nov. 20th")).toBe("2026-11-20");
    expect(dueDay("cad project due the 5th")).toBe("2026-12-05"); // the 5th already passed this month
    expect(dueDay("cad project due the 25th")).toBe("2026-11-25");
  });

  it("end of week and weekend", () => {
    expect(dueDay("speech reflection end of week")).toBe("2026-11-13");
    expect(dueDay("clean car this weekend")).toBe("2026-11-14");
  });

  it("times", () => {
    const time = (text: string) => p(text).when?.time;
    expect(time("algebra quiz fri 3pm")).toEqual({ hour: 15, minute: 0 });
    expect(time("algebra quiz fri 3 pm")).toEqual({ hour: 15, minute: 0 });
    expect(time("algebra quiz fri 3p")).toEqual({ hour: 15, minute: 0 });
    expect(time("algebra quiz fri 10:30am")).toEqual({ hour: 10, minute: 30 });
    expect(time("algebra quiz fri 15:00")).toEqual({ hour: 15, minute: 0 });
    expect(time("algebra quiz fri 11:59")).toEqual({ hour: 23, minute: 59 });
    expect(time("algebra quiz fri noon")).toEqual({ hour: 12, minute: 0 });
    expect(time("algebra quiz fri midnight")).toEqual({ hour: 23, minute: 59 });
    expect(time("algebra quiz fri at 3")).toEqual({ hour: 15, minute: 0 }); // guessed PM
    expect(time("algebra quiz fri by 9")).toEqual({ hour: 9, minute: 0 }); // guessed AM
    expect(p("algebra quiz fri at 3").problems.join(" ")).toMatch(/3 PM/);
  });

  it("a time with no day means today if it's still ahead, otherwise tomorrow", () => {
    expect(dueDay("call mom at 6pm")).toBe("2026-11-10");
    expect(dueDay("call mom at 9am")).toBe("2026-11-11");
  });

  it("doesn't mistake other numbers for times", () => {
    expect(p("ate 2 apples a day").when).toBeNull();
    expect(p("bench 3x10 @135").when).toBeNull();
    expect(p("ran 3 miles").when).toBeNull();
  });

  it("respects the time zone (Los Angeles has daylight saving, Phoenix doesn't)", () => {
    const summerPhx = { ...ctx, now: at("2026-07-07", 12) };
    const summerLa = { ...summerPhx, timeZone: "America/Los_Angeles" };
    expect(p("algebra quiz fri 9am", summerPhx).when?.dueAt.toISOString()).toBe("2026-07-10T16:00:00.000Z");
    expect(p("algebra quiz fri 9am", summerLa).when?.dueAt.toISOString()).toBe("2026-07-10T16:00:00.000Z");
    const winterLa = { ...ctx, timeZone: "America/Los_Angeles" };
    expect(p("algebra quiz fri 9am", winterLa).when?.dueAt.toISOString()).toBe("2026-11-13T17:00:00.000Z");
  });
});

describe("types and amounts", () => {
  it("expenses", () => {
    expect(p("paid $45.50 for phone bill")).toMatchObject({ type: "expense", amount: 45.5, category: "phone bill", title: "Phone bill" });
    expect(p("bought shoes 60 dollars")).toMatchObject({ type: "expense", amount: 60 });
    expect(p("spent money on lunch").problems).toContain("No amount found");
  });

  it("workouts", () => {
    expect(p("bench 3x10 @135")).toMatchObject({ type: "workout", sets: { sets: 3, reps: 10, weightLb: 135 } });
    expect(p("squats 4 sets of 8 at 185 lbs")).toMatchObject({ type: "workout", sets: { sets: 4, reps: 8, weightLb: 185 } });
    expect(p("ran 2.5 miles")).toMatchObject({ type: "workout", distanceMiles: 2.5 });
    expect(p("gym 45 min")).toMatchObject({ type: "workout", minutes: 45 });
  });

  it("estimates on homework", () => {
    expect(p("algebra homework due thurs about 2 hours").minutes).toBe(120);
    expect(p("speech outline due fri 45 min").minutes).toBe(45);
    expect(p("cad drawing due fri 1.5 hrs").minutes).toBe(90);
  });

  it("food quantities in words", () => {
    expect(p("ate two slices of pizza")).toMatchObject({ type: "food", quantity: 2 });
    expect(p("drank a protein shake")).toMatchObject({ type: "food", quantity: 1 });
  });

  it("money coming in is income, not spending", () => {
    expect(p("got paid $400 from PRMI")).toMatchObject({ type: "expense", amount: 400, incoming: true });
    expect(p("paycheck 650 dollars")).toMatchObject({ type: "expense", amount: 650, incoming: true });
    expect(p("spent $12 gas")).toMatchObject({ incoming: false });
  });

  it("habits", () => {
    expect(p("read 30 min")).toMatchObject({ type: "habit", habitName: "read", minutes: 30 });
  });

  it("notes keep their words", () => {
    expect(p("note: idea for app due to the weather").type).not.toBe("note");
  });

  it("plain to-dos are tasks; with nothing to go on, confidence drops", () => {
    const d = p("call mom");
    expect(d).toMatchObject({ type: "task", title: "Call mom" });
    expect(d.confidence).toBeLessThan(0.85);
    expect(p("pick up prescription tomorrow")).toMatchObject({ type: "task", title: "Pick up prescription", confidence: 1 });
  });

  it("homework without a date or class says what's missing", () => {
    const d = p("essay");
    expect(d.type).toBe("homework");
    expect(d.problems).toEqual(expect.arrayContaining(["No due date found", "No class matched"]));
  });
});
