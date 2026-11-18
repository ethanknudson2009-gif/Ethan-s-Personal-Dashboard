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
