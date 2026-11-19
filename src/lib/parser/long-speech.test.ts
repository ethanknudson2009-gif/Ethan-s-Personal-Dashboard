/**
 * Long talks and big spoken lists. The mic must turn 30+ seconds of
 * rambling into clean items: a short title, the right class and day, and the
 * extra details as notes, in any order and with or without punctuation.
 */
import { describe, expect, it } from "vitest";
import { fromLocal, toLocalDate } from "@/lib/time";
import type { ParseContext } from "./index";
import { parse } from "./index";
import { parseMany } from "./multi";
import { notePoints, organizeNotes, stripLeadIn } from "./notes";
import { normalizeSpoken } from "./spoken";

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
  { id: "eng", name: "English 1010", shortNames: ["english"] },
];
// "Now" = Tuesday Nov 10, 2026, 4:00 PM in Phoenix.
const base: ParseContext = { now: fromLocal("2026-11-10", { hour: 16, minute: 0 }, PHX), timeZone: PHX, classes, habits: ["read", "stretch"], spoken: true };

/** What the sheet does with what the mic heard. */
const hear = (said: string) => parseMany(normalizeSpoken(said), { ...base, caseSource: said });
const say = (said: string) => parse(normalizeSpoken(said), { ...base, caseSource: said });
const day = (d: { when: { dueAt: Date } | null }) => (d.when ? toLocalDate(d.when.dueAt, PHX) : null);
const summary = (said: string) =>
  hear(said).map(({ draft: d }) => ({ title: d.title, cls: d.className, day: day(d), notes: d.notes, type: d.type, area: d.area }));

describe("warm-up words are not the title", () => {
  it.each([
    ["okay so I need to call Mike tomorrow", "call Mike tomorrow"],
    ["um so basically remind me to buy milk", "buy milk"],
    ["alright I have to finish my essay", "finish my essay"],
    ["hey can you remind me to pay rent", "pay rent"],
    ["so I've got a quiz in anatomy friday", "quiz in anatomy friday"],
    ["there's a test in math on monday", "test in math on monday"],
    ["don't let me forget to text mom", "text mom"],
    ["add a task to clean my room", "clean my room"],
    ["I need to", "I need to"],
  ])("%s", (said, left) => expect(stripLeadIn(said)).toBe(left));
});

describe("notes are organized into clean points", () => {
  it("one detail stays a sentence", () => {
    expect(organizeNotes("it needs to be five pages")).toBe("Needs to be five pages");
  });
  it("several details become bullets, glue words removed", () => {
    expect(organizeNotes("it needs to be five pages and also make sure I use three sources and the teacher said MLA format")).toBe(
      "• Needs to be five pages\n• Make sure I use three sources\n• Teacher said MLA format",
    );
  });
  it("sentences, 'plus', 'oh and', 'another thing' all start a new point", () => {
    expect(notePoints("Bring the forms. Plus he wants the W2s oh and another thing is the rate lock expires")).toEqual([
      "Bring the forms",
      "He wants the W2s",
      "The rate lock expires",
    ]);
  });
  it("drops repeats and empty filler", () => {
    expect(notePoints("make sure it's stapled. make sure it's stapled. yeah. that's it")).toEqual(["Make sure it's stapled"]);
  });
});

describe("one long thought → title + notes", () => {
  it("homework with three details", () => {
    const d = say("okay so um I need to write my english essay due friday, it needs to be five pages and also make sure I use three sources and the teacher said MLA format");
    expect(d).toMatchObject({ type: "homework", className: "English 1010", title: "Write my essay" });
    expect(day(d)).toBe("2026-11-13");
    expect(d.notes).toBe("• Needs to be 5 pages\n• Make sure I use 3 sources\n• Teacher said MLA format");
  });
  it("work call with what Mike wants", () => {
    const d = say("so basically I have to call Mike tomorrow about the Johnson loan he wants the appraisal and the closing disclosure by noon and ask him if the rate lock is still good");
    expect(d).toMatchObject({ type: "task", area: "work", title: "Call Mike about the Johnson loan" });
    expect(day(d)).toBe("2026-11-11");
    expect(d.notes).toBe("• He wants the appraisal and the closing disclosure by noon\n• Ask him if the rate lock is still good");
  });
  it("quiz with what it covers and how to study", () => {
    const d = say("I have a quiz in anatomy on friday it covers the skeletal system and the muscles so I need to study the flashcards and also review chapter 3");
    expect(d).toMatchObject({ title: "Quiz", className: "Human Anatomy" });
    expect(d.notes).toBe("• Covers the skeletal system and the muscles\n• Study the flashcards\n• Review chapter 3");
  });
  it("a run-on with no markers gets a short title; the rest becomes notes", () => {
    const d = say("write an essay about the great gatsby and the american dream using at least three quotes from the book");
    expect(d.title.split(" ").length).toBeLessThanOrEqual(9);
    expect(d.notes).toMatch(/american dream/i);
  });
  it("a one-word thing with a detail", () => {
    expect(say("laundry, it's piling up")).toMatchObject({ title: "Laundry", notes: "It's piling up" });
  });
  it("food words in the details don't make it a food log", () => {
    expect(say("pick up mom at 5 and grab lunch on the way").type).toBe("task");
    expect(say("go to the gym at 6 tomorrow").type).toBe("task");
  });
  it("a 40-second ramble", () => {
    const d = say(
      "okay so for my world history class I have a project due next wednesday and it's a group project with Sarah and Jake and we need to make a poster about the industrial revolution and the teacher said it has to have at least five pictures and a timeline and also we're presenting it in front of the class so I should practice what I'm going to say",
    );
    expect(d.className).toBe("World History");
    expect(d.title.split(" ").length).toBeLessThanOrEqual(9);
    expect(d.title).toMatch(/project/i);
    expect(d.notes).toMatch(/Sarah and Jake/);
    expect(d.notes).toMatch(/five pictures|5 pictures/);
    expect(d.notes).toMatch(/practice/);
    expect(d.notes!.split("\n").length).toBeGreaterThanOrEqual(3);
  });
});

describe("big lists → many items", () => {
  it("a real morning list with an opener date", () => {
    expect(
      summary(
        "okay for tomorrow: call Mike about the Johnson file, he wants the appraisal. Then English essay due Friday, it needs to be five pages. Also buy milk, eggs and bread, and pay the phone bill",
      ),
    ).toEqual([
      { title: "Call Mike about the Johnson file", cls: null, day: "2026-11-11", notes: "He wants the appraisal", type: "task", area: "work" },
      { title: "Essay", cls: "English 1010", day: "2026-11-13", notes: "Needs to be 5 pages", type: "homework", area: "school" },
      { title: "Buy milk, eggs and bread", cls: null, day: "2026-11-11", notes: null, type: "task", area: "personal" },
      { title: "Pay the phone bill", cls: null, day: "2026-11-11", notes: null, type: "task", area: "personal" },
    ]);
  });

  it("no punctuation at all (how Chrome hears it)", () => {
    const s = summary("call Mike tomorrow buy milk email the teacher about the quiz pick up my check on friday");
    expect(s.map((x) => x.title)).toEqual(["Call Mike", "Buy milk", "Email the teacher about the quiz", "Pick up my check"]);
    expect(s.map((x) => x.day)).toEqual(["2026-11-11", null, null, "2026-11-13"]);
  });

  it("first / second / and then / oh and also", () => {
    const s = summary(
      "okay so I have a bunch of things to do first I need to finish my algebra homework it's due tomorrow at 8 second I need to call the dentist and schedule a cleaning and then I have to pick up my sister from practice at 5 oh and also remind me to pay rent on the first",
    );
    expect(s.map((x) => x.title)).toEqual(["Finish my homework", "Call the dentist and schedule a cleaning", "Pick up my sister from practice", "Pay rent"]);
    expect(s[0]).toMatchObject({ cls: "College Algebra", day: "2026-11-11" });
    expect(s[3].day).toBe("2026-12-01");
  });

  it("work list after 'for work:' is all work", () => {
    const s = summary(
      "for work: send the disclosures to the Smith borrower, order the appraisal for the Johnson loan, and follow up with the title company about the closing date",
    );
    expect(s.map((x) => x.title)).toEqual(["Send the disclosures to the Smith borrower", "Order the appraisal for the Johnson loan", "Follow up with the title company"]);
    expect(s.every((x) => x.area === "work")).toBe(true);
    expect(s[2].notes).toBe("About the closing date");
  });

  it("two assignments for one class share the class", () => {
    const s = summary("I have an english essay due friday and a quiz monday");
    expect(s).toMatchObject([
      { title: "Essay", cls: "English 1010", day: "2026-11-13" },
      { title: "Quiz", cls: "English 1010", day: "2026-11-16" },
    ]);
  });

  it("two school items, each with its own notes", () => {
    const s = summary(
      "write my speech outline due thursday it needs to be three pages and include two sources and then study for my anatomy test on friday it covers the skeletal system make sure I review the flashcards",
    );
    expect(s).toMatchObject([
      { title: "Write my outline", cls: "Speech", day: "2026-11-12", notes: "Needs to be 3 pages and include 2 sources" },
      { title: "Study for my test", cls: "Human Anatomy", day: "2026-11-13", notes: "• Covers the skeletal system\n• Make sure I review the flashcards" },
    ]);
  });

  it("typed list, one per line", () => {
    const s = parseMany("- call grandma\n- algebra homework due wed\n- buy a birthday card\n  for mom", { ...base, spoken: false }).map((x) => ({ title: x.draft.title, notes: x.draft.notes }));
    expect(s.map((x) => x.title)).toEqual(["Call grandma", "Homework", "Buy a birthday card"]);
    expect(s[2].notes).toBe("For mom");
  });

  it("mixed kinds: a task, money and food in one breath", () => {
    const s = summary("call the bank tomorrow. I spent 12 dollars on gas. I had a burrito for lunch, it was about 700 calories");
    expect(s.map((x) => x.type)).toEqual(["task", "expense", "food"]);
  });

  it("a 45-second day plan, said naturally", () => {
    const s = summary(
      "Okay so tomorrow I have a lot going on. In the morning I need to drop off my car at the shop, they said it'll take about two hours. Then at work I need to call Mike about the Henderson refi, he wants the bank statements and the W2s before Thursday. After that I have choir practice at 3, and I need to bring my folder. Oh and I have an AutoCAD drawing due Wednesday, it has to be the floor plan with dimensions. And don't let me forget to pay my phone bill, it's 65 dollars",
    );
    expect(s).toMatchObject([
      { title: "Drop off my car at the shop", day: "2026-11-11", notes: "They said it'll take about 2 hours", area: "personal" },
      { title: "Call Mike about the Henderson refi", day: "2026-11-11", notes: "He wants the bank statements and the W2s before Thursday", area: "work" },
      { title: "Practice", cls: "Choir", day: "2026-11-11", notes: "Bring my folder" },
      { title: "Drawing", cls: "AutoCAD", day: "2026-11-11", notes: "Has to be the floor plan with dimensions" },
      { title: "Pay my phone bill", day: "2026-11-11", notes: "It's 65 dollars" },
    ]);
  });

  it("a homework ramble with no punctuation", () => {
    const s = summary(
      "um so I've got like a ton of homework this week there's an anatomy quiz on thursday it's on the muscles of the arm and then my english essay is due friday and it needs to be four pages MLA and also I have a math test next monday so I should probably start studying for that on the weekend",
    );
    expect(s).toMatchObject([
      { title: "Quiz", cls: "Human Anatomy", day: "2026-11-12", notes: "On the muscles of the arm" },
      { title: "Essay", cls: "English 1010", day: "2026-11-13", notes: "Needs to be 4 pages MLA" },
      { title: "Test", cls: "College Algebra", day: "2026-11-16", notes: "I should probably start studying for that on the weekend" },
    ]);
  });

  it("a work list with no punctuation", () => {
    const s = summary(
      "alright work stuff for tomorrow order the appraisal on the Garcia file follow up with the title company on the Johnson closing send the initial disclosures to the new borrower",
    );
    expect(s.map((x) => x.title)).toEqual(["Order the appraisal on the Garcia file", "Follow up with the title company", "Send the initial disclosures to the new borrower"]);
    expect(s.every((x) => x.area === "work" && x.day === "2026-11-11")).toBe(true);
  });

  describe("things that must stay ONE item", () => {
    it.each([
      "call Mike and ask him about the appraisal",
      "buy milk, eggs, and bread",
      "pick up mom at 5 and grab lunch on the way",
      "call the dentist and schedule a cleaning",
      "english essay due friday it needs to be five pages and make sure I use three sources",
      "study for the algebra test thursday it covers chapters 4 and 5 and I need to review the practice problems",
      "text Jake and tell him I'll be late",
      "next friday turn in the speech outline",
      "finish the first draft of my essay by sunday",
      "bench 3x10 at 135 then incline dumbbell 3x8 at 50 then cable flys",
      "today was great, I got a lot done and then I went to the gym",
      "note: the wifi password is on the fridge",
      "email the teacher about the quiz and ask if I can retake it",
      "it's mom's birthday on saturday so get her a card",
      "I need to call grandma this weekend and wish her happy birthday, she turns 80",
      "after that I have choir practice at 3",
    ])("%s", (said) => expect(hear(said)).toHaveLength(1));
  });
});

// ── The generator: thousands of spoken lists ────────────────────────────────
// Each task can be said with or without a detail; tasks are glued together
// with every kind of connector people use; with and without punctuation.
type T = { said: string; title: string; day: string | null; cls?: string };
const TASKS: T[] = [
  { said: "call Mike tomorrow", title: "Call Mike", day: "2026-11-11" },
  { said: "buy milk and eggs", title: "Buy milk and eggs", day: null },
  { said: "pay the phone bill on friday", title: "Pay the phone bill", day: "2026-11-13" },
  { said: "email the Smith borrower about the rate lock", title: "Email the Smith borrower about the rate lock", day: null },
  { said: "english essay due friday", title: "Essay", day: "2026-11-13", cls: "English 1010" },
  { said: "anatomy lab report due thursday", title: "Lab report", day: "2026-11-12", cls: "Human Anatomy" },
  { said: "pick up my sister at 5", title: "Pick up my sister", day: "2026-11-10" },
  { said: "schedule a dentist appointment", title: "Schedule a dentist appointment", day: null },
  { said: "study for my algebra test on monday", title: "Study for my test", day: "2026-11-16", cls: "College Algebra" },
  { said: "send the disclosures to Mike", title: "Send the disclosures to Mike", day: null },
  { said: "clean my room tonight", title: "Clean my room", day: "2026-11-10" },
  { said: "return the library books on wednesday", title: "Return the library books", day: "2026-11-11" },
  { said: "order the appraisal for the Johnson loan", title: "Order the appraisal for the Johnson loan", day: null },
  { said: "write my speech outline by thursday", title: "Write my outline", day: "2026-11-12", cls: "Speech" },
  { said: "get gas", title: "Get gas", day: null },
  { said: "text Jake about the game saturday", title: "Text Jake about the game", day: "2026-11-14" },
  { said: "turn in the permission slip tomorrow", title: "Turn in the permission slip", day: "2026-11-11" },
  { said: "finish the AutoCAD drawing by wednesday", title: "Finish the drawing", day: "2026-11-11", cls: "AutoCAD" },
  { said: "meet with Mike at 2 tomorrow", title: "Meet with Mike", day: "2026-11-11" },
  { said: "work on my church history reading", title: "Work on my reading", day: null, cls: "Church History" },
  { said: "do laundry", title: "Do laundry", day: null },
  { said: "make a doctor appointment", title: "Make a doctor appointment", day: null },
  { said: "drop off the package at the post office", title: "Drop off the package at the post office", day: null },
  { said: "cancel my gym membership", title: "Cancel my gym membership", day: null },
  { said: "call the bank about the late fee", title: "Call the bank about the late fee", day: null },
];
const NOTES: { said: string; note: string }[] = [
  { said: "make sure to bring the forms", note: "Make sure to bring the forms" },
  { said: "it has to be three pages", note: "Has to be 3 pages" },
  { said: "he wants the paperwork signed", note: "He wants the paperwork signed" },
  { said: "the teacher said use MLA format", note: "Teacher said use MLA format" },
  { said: "don't forget the receipt", note: "Don't forget the receipt" },
  { said: "it's for the field trip", note: "It's for the field trip" },
  { said: "he said to bring the W2s", note: "He said to bring the W2s" },
  { said: "it's in the blue folder", note: "It's in the blue folder" },
  { said: "ask about the payment plan", note: "Ask about the payment plan" },
  { said: "because the old one expired", note: "Because the old one expired" },
];
const JOIN_PUNCT = [". ", ". Then ", ", then ", " and then ", ". Also ", ", also ", ". Next, ", ". Oh and ", ". After that ", ". Another thing, ", "; ", ". Plus ", ". I also need to ", ", and I have to ", ". Also I need to ", ". And then I gotta ", ". Okay and ", ". Next thing is "];
const JOIN_BARE = [" then ", " and then ", " also ", " oh and ", " after that ", " another thing ", " next ", " plus ", " and also ", " I also need to ", " and I have to ", " then I gotta ", " okay and then ", " and I need to "];
const LEADS = ["", "okay so ", "um so ", "alright ", "okay here's my list: ", "so I have a few things to do. ", "real quick ", "okay I've got a bunch of stuff to do ", "here's my to do list ", "so first ", "um okay so I need to "];
const NOTE_GLUE_PUNCT = [", ", ". ", " "];

/** A small fixed-seed random generator, so failures are repeatable. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
const pick = <X,>(r: () => number, xs: X[]) => xs[Math.floor(r() * xs.length)];

function makeCase(r: () => number, punctuated: boolean) {
  const n = 2 + Math.floor(r() * 5); // 2–6 items
  const pool = [...TASKS];
  const chosen: { t: T; note: (typeof NOTES)[number] | null }[] = [];
  for (let i = 0; i < n; i++) {
    const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
    chosen.push({ t, note: r() < 0.45 ? pick(r, NOTES) : null });
  }
  let said = pick(r, LEADS);
  chosen.forEach(({ t, note }, i) => {
    if (i > 0) said += punctuated ? pick(r, JOIN_PUNCT) : pick(r, JOIN_BARE);
    said += t.said;
    if (note) said += (punctuated ? pick(r, NOTE_GLUE_PUNCT) : " ") + note.said;
  });
  if (!punctuated) said = said.replace(/[.,:;]/g, "").replace(/\n/g, " ");
  return { said, chosen };
}

function check(said: string, chosen: { t: T; note: { note: string } | null }[]): string | null {
  const got = hear(said).map((x) => x.draft);
  if (got.length !== chosen.length) return `expected ${chosen.length} items, got ${got.length}: ${got.map((d) => JSON.stringify(d.title)).join(", ")}`;
  for (let i = 0; i < chosen.length; i++) {
    const { t, note } = chosen[i];
    const d = got[i];
    if (d.title !== t.title) return `item ${i + 1} title ${JSON.stringify(d.title)} ≠ ${JSON.stringify(t.title)}`;
    if (day(d) !== t.day) return `item ${i + 1} (${t.title}) day ${day(d)} ≠ ${t.day}`;
    if ((d.className ?? undefined) !== t.cls) return `item ${i + 1} (${t.title}) class ${d.className} ≠ ${t.cls}`;
    const notes = d.notes ?? "";
    if (note && !notes.toLowerCase().includes(note.note.toLowerCase())) return `item ${i + 1} (${t.title}) notes ${JSON.stringify(notes)} missing ${JSON.stringify(note.note)}`;
    if (!note && notes) return `item ${i + 1} (${t.title}) has unexpected notes ${JSON.stringify(notes)}`;
  }
  return null;
}

describe("generated spoken lists", () => {
  for (const punctuated of [true, false]) {
    it(`3,000 random lists ${punctuated ? "with" : "without"} punctuation come out exactly right`, () => {
      const r = rng(punctuated ? 7 : 11);
      const failures: string[] = [];
      for (let k = 0; k < 3000; k++) {
        const { said, chosen } = makeCase(r, punctuated);
        const problem = check(said, chosen);
        if (problem) failures.push(`${JSON.stringify(said)}\n    → ${problem}`);
      }
      expect(failures.slice(0, 12).join("\n"), `${failures.length} of 3000 failed`).toBe("");
    }, 60_000);
  }

  it("every task alone, with every detail, is one item with the right title and notes", () => {
    const failures: string[] = [];
    for (const t of TASKS)
      for (const n of NOTES)
        for (const glue of [", ", ". ", " "]) {
          const said = `${t.said}${glue}${n.said}`;
          const problem = check(said, [{ t, note: n }]);
          if (problem) failures.push(`${JSON.stringify(said)} → ${problem}`);
        }
    expect(failures.slice(0, 12).join("\n"), `${failures.length} failed`).toBe("");
  });
});
