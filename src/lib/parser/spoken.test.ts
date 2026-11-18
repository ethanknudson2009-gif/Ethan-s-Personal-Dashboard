import { describe, expect, it } from "vitest";
import { fromLocal, toLocalDate } from "@/lib/time";
import { parse, type ParseContext } from "./index";
import { editDistance, normalizeSpoken, snapWord } from "./spoken";

const PHX = "America/Phoenix";
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
// "Now" = Tuesday Nov 17, 2026, 4 PM in Phoenix.
const ctx: ParseContext = { now: fromLocal("2026-11-17", { hour: 16, minute: 0 }, PHX), timeZone: PHX, classes, spoken: true };
const say = (text: string) => parse(text, ctx);
const day = (text: string) => {
  const w = say(text).when;
  return w ? toLocalDate(w.dueAt, PHX) : null;
};

describe("normalizeSpoken", () => {
  it("drops fillers and polite openers", () => {
    expect(normalizeSpoken("Um can you add uh speech outline due Thursday")).toBe("speech outline due thursday");
    expect(normalizeSpoken("Remind me to call mom tomorrow")).toBe("call mom tomorrow");
    expect(normalizeSpoken("okay so I need to finish the algebra worksheet")).toBe("finish the algebra worksheet");
  });

  it("turns spoken times into digits", () => {
    expect(normalizeSpoken("due friday at eleven fifty nine p.m.")).toBe("due friday at 11:59pm");
    expect(normalizeSpoken("quiz at three thirty pm")).toBe("quiz at 3:30pm");
    expect(normalizeSpoken("meeting at seven o'clock")).toBe("meeting at 7:00");
    expect(normalizeSpoken("practice at three in the afternoon")).toBe("practice at 3pm");
    expect(normalizeSpoken("study at nine in the morning")).toBe("study at 9am");
    expect(normalizeSpoken("call at five oh five pm")).toBe("call at 5:05pm");
  });

  it("turns other number words and ordinals into digits", () => {
    expect(normalizeSpoken("spent twenty five dollars on gas")).toBe("spent 25 dollars on gas");
    expect(normalizeSpoken("ate two eggs")).toBe("ate 2 eggs");
    expect(normalizeSpoken("essay due november twentieth")).toBe("essay due november 20th");
    expect(normalizeSpoken("project due on the third")).toBe("project due on the 3rd");
    expect(normalizeSpoken("one more thing")).toBe("one more thing"); // "one" stays a word here
  });

  it("snaps misheard days and months", () => {
    expect(snapWord("wensday")).toBe("wednesday");
    expect(snapWord("thursdy")).toBe("thursday");
    expect(snapWord("tomorow")).toBe("tomorrow");
    expect(snapWord("hello")).toBeNull();
    expect(snapWord("money")).toBeNull(); // too far from "monday"
    expect(editDistance("anatomy", "andatomy")).toBe(1);
  });
});

describe("talking naturally (any order)", () => {
  it("class, title and day in any order", () => {
    for (const text of [
      "speech outline due thursday",
      "due thursday speech outline",
      "outline for speech thursday",
      "thursday I have a speech outline due",
    ]) {
      const d = say(text);
      expect(d.classId, text).toBe("speech");
      expect(d.when?.date, text).toBe("2026-11-19");
    }
  });

  it("misheard class names still find the class", () => {
    expect(say("and atomy lab report due friday").classId).toBe("anat");
    expect(say("auto cad drawing due monday").classId).toBe("cad");
    expect(say("a i master mind project due wednesday").classId).toBe("ai");
    expect(say("collage algebra homework tomorrow").classId).toBe("alg");
    expect(say("church histery reading due friday").classId).toBe("ch");
  });

  it("spoken dates and times", () => {
    expect(day("um algebra quiz wensday")).toBe("2026-11-18");
    expect(say("speech outline due friday at eleven fifty nine pm").when?.time).toEqual({ hour: 23, minute: 59 });
    expect(say("anatomy test review thursday at three in the afternoon").when?.time).toEqual({ hour: 15, minute: 0 });
    expect(day("world history essay due november twentieth")).toBe("2026-11-20");
    expect(day("remind me to pick up my prescription tomorrow")).toBe("2026-11-18");
  });

  it("keeps a clean title", () => {
    expect(say("can you add uh speech outline due thursday").title).toBe("Outline");
    expect(say("remind me to call mom tomorrow").title).toBe("Call mom");
  });

  it("history alone still asks which class", () => {
    expect(say("history essay due friday").classId).toBeNull();
  });
});

describe("picking the best of several hearings", () => {
  it("prefers the guess that names a class and a day", async () => {
    const { pickBestHearing } = await import("./best");
    expect(pickBestHearing(["speech out line due thirsty", "speech outline due thursday", "speak outline do thursday"], ctx)).toBe(
      "speech outline due thursday",
    );
    expect(pickBestHearing(["call mom tomorrow", "call mom to borrow"], ctx)).toBe("call mom tomorrow");
  });

  it("keeps the recognizer's first choice on a tie", async () => {
    const { pickBestHearing } = await import("./best");
    expect(pickBestHearing(["buy milk", "by milk"], ctx)).toBe("buy milk");
  });
});

describe("notes and work", () => {
  it("splits a long message into title + notes", () => {
    const d = say("speech outline due thursday it needs to be three pages and include two sources");
    expect(d).toMatchObject({ classId: "speech", title: "Outline", notes: "It needs to be 3 pages and include 2 sources" });
    expect(d.when?.date).toBe("2026-11-19");
  });

  it("a new sentence or 'make sure' starts the notes too", () => {
    expect(say("anatomy lab report due friday. Use the data from Tuesday's lab").notes).toBe("Use the data from tuesday lab");
    expect(say("college algebra homework tomorrow make sure to show work").notes).toBe("Make sure to show work");
    expect(say("call mom tomorrow").notes).toBeNull();
  });

  it("work tasks for PRMI go to the work area, without 'at work' in the title", () => {
    const d = say("at work send the loan files to my manager tomorrow");
    expect(d).toMatchObject({ area: "work", type: "task", title: "Send the loan files to my manager" });
    const p = say("PRMI call the client back friday because they had questions about the rate");
    expect(p).toMatchObject({ area: "work", title: "Call the client back", notes: "Because they had questions about the rate" });
    expect(say("prmi job training thursday").type).toBe("task"); // a work task
  });

  it("school and personal areas", () => {
    expect(say("speech outline due thursday").area).toBe("school");
    expect(say("pick up my prescription tomorrow").area).toBe("personal");
  });
});

describe("Ethan's work words (PRMI = work = primary = the office; Mike is his LO)", () => {
  it("all the names for work go to the Work area and stay out of the title", () => {
    expect(say("primary send mike the loan files tomorrow")).toMatchObject({ area: "work", title: "Send Mike the loan files" });
    expect(say("at the office update the borrower list friday")).toMatchObject({ area: "work", title: "Update the borrower list" });
    expect(say("P R M I team meeting thursday at nine")).toMatchObject({ area: "work", title: "Team meeting" });
    expect(say("work: clean up my desk")).toMatchObject({ area: "work", title: "Clean up my desk" });
  });

  it("mentioning Mike means work", () => {
    expect(say("ask mike about the closing date tomorrow").area).toBe("work");
  });

  it("'primary' inside school work stays school", () => {
    const d = say("world history essay find a primary source due friday");
    expect(d).toMatchObject({ area: "school", classId: "wh" });
  });
});
