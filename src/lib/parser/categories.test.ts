import { describe, expect, it } from "vitest";
import { findHabit, moodOf, parse } from "./index";

/** Real things Ethan might say into the mic, one for each kind of item. */
const classes = ["World History", "Choir", "Human Anatomy", "AI Mastermind", "College Algebra", "Speech", "AutoCAD", "Church History"].map(
  (name, i) => ({ id: String(i), name }),
);
const p = (text: string) =>
  parse(text, {
    now: new Date("2026-11-19T17:00:00Z"), // Thursday 10 AM in Denver
    timeZone: "America/Denver",
    classes,
    habits: ["Reading", "Water", "Meditate", "Gym"],
    spoken: true,
  });

describe("every category from the mic", () => {
  it("school: subjects like 'math' find the class", () => {
    const d = p("math homework due tomorrow");
    expect(d.className).toBe("College Algebra");
    expect(d.when?.date).toBe("2026-11-20");
  });

  it("school: extra details become notes", () => {
    const d = p("study for the algebra test thursday it covers chapters 4 and 5 and I need to review the practice problems");
    expect(d.title).toBe("Study for the test");
    expect(d.notes).toBe("• Covers chapters 4 and 5\n• Review the practice problems");
  });

  it("work: mortgage words, names keep their capitals, 'end of day' is 5 PM today", () => {
    const d = p("send the disclosures for the Smith loan by end of day");
    expect(d.area).toBe("work");
    expect(d.title).toBe("Send the disclosures for the Smith loan");
    expect(d.when).toMatchObject({ date: "2026-11-19", time: { hour: 17, minute: 0 } });
    expect(p("order appraisal for 123 main street").area).toBe("work");
  });

  it("money: income and payments without a $ sign", () => {
    expect(p("got paid 450")).toMatchObject({ type: "expense", amount: 450, incoming: true, title: "Paycheck" });
    expect(p("paycheck 612.40")).toMatchObject({ type: "expense", amount: 612.4, incoming: true });
    expect(p("venmo'd jake 15 for pizza")).toMatchObject({ type: "expense", amount: 15, incoming: false });
  });

  it("money: a bill to pay later is a task, not spending", () => {
    expect(p("pay phone bill on the 1st")).toMatchObject({ type: "task", title: "Pay phone bill" });
  });

  it("food: calories and protein are pulled out", () => {
    expect(p("ate a chicken burrito 700 calories")).toMatchObject({ type: "food", title: "Chicken burrito", calories: 700 });
    expect(p("protein shake 250 cals 30g protein")).toMatchObject({ calories: 250, proteinG: 30 });
  });

  it("gym: lifts and cardio", () => {
    expect(p("bench 3x10 at 135").sets).toEqual({ sets: 3, reps: 10, weightLb: 135 });
    expect(p("ran 2 miles in 18 minutes")).toMatchObject({ type: "workout", title: "Run", distanceMiles: 2, minutes: 18 });
  });

  it("habits by any form of the word", () => {
    expect(p("did my reading").habitName).toBe("Reading");
    expect(p("drank water").habitName).toBe("Water");
    expect(p("meditated 10 minutes").habitName).toBe("Meditate");
    expect(findHabit("went to the gym", ["Gym", "Gym class"])).toBe("Gym");
    // A class or "due" wins over a habit word.
    expect(p("church history reading due wed").type).toBe("homework");
  });

  it("journal lines and moods", () => {
    expect(p("I feel great today")).toMatchObject({ type: "note", mood: 5 });
    expect(p("today was rough, so tired").mood).toBe(1);
    expect(moodOf("it was not great")).toBe(2);
    expect(p("note: mike prefers emails over texts").type).toBe("note");
  });

  it("repeating to-dos", () => {
    expect(p("every monday take out trash")).toMatchObject({ title: "Take out trash", repeat: "weekly", when: { date: "2026-11-23" } });
    expect(p("water the plants every other week").repeat).toBe("biweekly");
    expect(p("pay rent monthly on the 1st").repeat).toBe("monthly");
  });
});
