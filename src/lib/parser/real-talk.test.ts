/**
 * Things Ethan actually said (or the way he talks), with exactly what each
 * should turn into. The first few came from real tasks that saved wrong
 * (Nov 19–20, 2026): "Off" as a title, "Homework" with "I need to" as notes,
 * "remember" heard as "December".
 */
import { describe, expect, it } from "vitest";
import { parse, type ParseContext } from "./index";
import { parseMany } from "./multi";

const ctx: ParseContext = {
  now: new Date("2026-11-22T17:00:00Z"), // Sunday Nov 22, 10 AM in Phoenix
  timeZone: "America/Phoenix",
  spoken: true,
  classes: [
    { id: "h", name: "World History", shortNames: ["history"] },
    { id: "s", name: "Speech", shortNames: [] },
    { id: "m", name: "College Algebra", shortNames: ["math", "algebra"] },
    { id: "a", name: "Anatomy", shortNames: [] },
  ],
};

type Want = { title: string; cls?: string | null; day?: string | null; notes?: string | null; area?: string };
const one = (said: string) => {
  const d = parse(said, ctx);
  return { title: d.title, cls: d.className, day: d.when?.date ?? null, notes: d.notes, area: d.area };
};
const many = (said: string) =>
  parseMany(said, ctx).map(({ draft: d }) => ({ title: d.title, cls: d.className, day: d.when?.date ?? null, notes: d.notes, area: d.area }));

describe("real things that saved wrong before", () => {
  it.each<[string, Want]>([
    ["Make sure Mike Johnson gets those initial disclosures signed off", { title: "Make sure Mike Johnson gets those initial disclosures signed off", notes: null, area: "work" }],
    ["remember to email my anatomy teacher about the lab I missed on tuesday", { title: "Email my teacher about the lab I missed on tuesday", cls: "Anatomy", day: null }],
    ["so for speech I need to memorize the first half of my Joseph Smith speech by wednesday", { title: "Memorize the first half of my Joseph Smith speech", cls: "Speech", day: "2026-11-25", notes: null }],
    ["check in with Kristin Kennedy tomorrow about her appraisal it came back low and she needs to know her options", { title: "Check in with Kristin Kennedy about her appraisal", day: "2026-11-23", notes: "It came back low and she needs to know her options", area: "work" }],
  ])("%s", (said, want) => expect(one(said)).toMatchObject(want));

  it("the homework list from Nov 19", () => {
    expect(
      many(
        "I need to do homework for world history I have some textbook questions I need to get done I'll look at in my photos app is where the textbook questions are and I need to get pictures off my slideshow print them out",
      ),
    ).toMatchObject([
      { title: "Textbook questions", cls: "World History", notes: "I'll look at in my photos app is where the textbook questions are" },
      { title: "Get pictures off my slideshow print them out", cls: null },
    ]);
  });
});

describe("how Ethan talks", () => {
  it.each<[string, Want]>([
    ["remember to bring my gym clothes tomorrow", { title: "Bring my gym clothes", day: "2026-11-23" }],
    ["don't forget to text mom back about dinner", { title: "Text mom back about dinner" }],
    ["make sure to submit the anatomy lab report by friday at midnight", { title: "Submit the lab report", cls: "Anatomy", day: "2026-11-27" }],
    ["I have to call the title company about the Garcia closing it got pushed to next week", { title: "Call the title company about the Garcia closing", day: null, notes: "It got pushed to next week", area: "work" }],
    ["I need to finish my speech outline it needs an intro a body and a conclusion and it's due thursday", { title: "Finish my outline", cls: "Speech", day: "2026-11-26", notes: "It needs an intro a body and a conclusion" }],
    ["Mike wants me to send the pre approval letter to the Hendersons today he said they're making an offer tonight", { title: "Send the pre approval letter to the Hendersons", day: "2026-11-22", notes: "He said they're making an offer tonight", area: "work" }],
    ["I have some reading for world history chapter 7 I need to get done before Wednesday", { title: "Reading for chapter 7", cls: "World History", day: "2026-11-25" }],
    ["um so basically I have a quiz on monday in algebra and it's on factoring and the quadratic formula", { title: "Quiz", cls: "College Algebra", day: "2026-11-23", notes: "On factoring and the quadratic formula" }],
    ["I need to study for my anatomy test on the first it covers the first three chapters", { title: "Study for my test", cls: "Anatomy", day: "2026-12-01", notes: "Covers the first 3 chapters" }],
    ["the history essay that was due yesterday I still need to finish it tonight", { title: "Essay", cls: "World History", day: "2026-11-22", notes: "Finish it tonight" }],
    ["get the oil changed this weekend the car is making a weird noise", { title: "Get the oil changed", day: "2026-11-28", notes: "The car is making a weird noise" }],
    ["schedule a dentist appointment for next month I think it's been like a year", { title: "Schedule a dentist appointment for next month", notes: "I think it's been like a year" }],
    ["pay my phone bill on the 15th it's 45 dollars", { title: "Pay my phone bill", day: "2026-12-15", notes: "It's 45 dollars" }],
    ["practice my speech in front of someone at least twice before the 3rd", { title: "Practice my speech in front of someone at least twice", cls: "Speech", day: "2026-12-03" }],
    ["for speech class I have to memorize the second paragraph by tomorrow", { title: "Memorize the second paragraph", cls: "Speech", day: "2026-11-23" }],
    ["I need to email my teacher because I was sick on monday and missed the test", { title: "Email my teacher", day: null, notes: "Because I was sick on monday and missed the test" }],
    ["buy a birthday present for Jake his party is on saturday at 6", { title: "Buy a birthday present for Jake", cls: null, day: "2026-11-28", notes: "His party is on saturday at 6", area: "personal" }],
    ["PRMI call the client back friday because they had questions about the rate", { title: "Call the client back", notes: "Because they had questions about the rate", area: "work" }],
  ])("%s", (said, want) => expect(one(said)).toMatchObject(want));

  it.each<[string, Want]>([
    // Nov 22 batch: words that used to go missing or land in the wrong place.
    ["read chapter 9 for anatomy and do the vocab", { title: "Read chapter 9 and do the vocab", cls: "Anatomy" }],
    ["memorize lines for speech and practice them out loud three times", { title: "Memorize lines and practice them out loud 3 times", cls: "Speech" }],
    ["email my counselor about switching out of choir next semester", { title: "Email my counselor about switching out of choir next semester" }],
    ["I have to go to work at 3 tomorrow", { title: "Go to work", day: "2026-11-23", area: "work" }],
    ["I need to get gas tomorrow morning before school", { title: "Get gas before school", day: "2026-11-23" }],
    ["I have a dentist appointment on the 30th at 2 30", { title: "Dentist appointment", day: "2026-11-30" }],
    ["put the Garcia appraisal in the file and let Mike know it came in", { title: "Put the Garcia appraisal in the file", notes: "Let Mike know it came in", area: "work" }],
    ["I need to buy new running shoes my old ones have holes in them", { title: "Buy new running shoes", notes: "My old ones have holes in them" }],
    ["update the loan estimate for the Brown family the rate changed", { title: "Update the loan estimate for the Brown family", notes: "The rate changed", area: "work" }],
    ["tell Mike the Peterson file is missing a bank statement from October", { title: "Tell Mike the Peterson file is missing a bank statement from October", notes: null }],
    ["I got to upload the Ramirez pay stubs to the portal before noon tomorrow", { title: "Upload the Ramirez pay stubs to the portal", day: "2026-11-23", area: "work" }],
    ["I want to start going to bed earlier like by 10", { title: "Start going to bed earlier" }],
    ["add the receipts to the Garcia file", { title: "Add the receipts to the Garcia file" }],
    ["add speech outline due thursday", { title: "Outline", cls: "Speech", day: "2026-11-26" }],
    ["add eggs and bread to my list", { title: "Eggs and bread" }],
  ])("%s", (said, want) => expect(one(said)).toMatchObject(want));

  it.each<[string, Partial<Want> & { type?: string }]>([
    // Work words from PRMI
    ["send the LE to the Hendersons by end of day", { title: "Send the LE to the Hendersons", area: "work" }],
    ["I need to order the condo questionnaire for the Smith file", { title: "Order the condo questionnaire for the Smith file", area: "work" }],
    ["get the gift letter signed for the Lopez loan before we submit to underwriting", { title: "Get the gift letter signed for the Lopez loan", notes: "Before we submit to underwriting", area: "work" }],
    ["run DU on the Patel file and send Mike the findings", { type: "task", title: "Run DU on the Patel file and send Mike the findings", area: "work" }],
    ["we got clear to close on the Wilson loan tell Mike", { title: "Tell Mike we got clear to close on the Wilson loan", area: "work" }],
    ["the Garcia file has a COC the rate lock expires friday", { title: "Garcia file has a COC", notes: "The rate lock expires friday", area: "work" }],
    ["call the borrower about the letter of explanation for the large deposit", { title: "Call the borrower about the letter of explanation for the large deposit", area: "work" }],
    // Gym slang is a workout
    ["benched 225 for 5 then 185 for 8", { type: "workout" }],
    ["pulled 315 for a PR", { type: "workout" }],
    ["hit legs today squat 3 plates for 3", { type: "workout" }],
    // Everyday life
    ["costco run this weekend for groceries", { type: "task", title: "Costco run for groceries", day: "2026-11-28" }],
    ["meal prep on sunday chicken and rice", { title: "Meal prep chicken and rice" }],
    ["hit up Tyler about the game friday night", { title: "Hit up Tyler about the game", day: "2026-11-27" }],
    ["FaceTime grandma tomorrow after school", { title: "FaceTime grandma after school", day: "2026-11-23" }],
    ["oil change saturday morning", { title: "Oil change", day: "2026-11-28" }],
    ["grabbed a protein shake 300 calories 40 grams protein", { type: "food", title: "Protein shake" }],
    ["lunch with mom on sunday at noon", { type: "task", title: "Lunch with mom" }],
  ])("%s", (said, want) => {
    const d = parse(said, ctx);
    expect({ type: d.type, title: d.title, cls: d.className, day: d.when?.date ?? null, notes: d.notes, area: d.area }).toMatchObject(want);
  });

  it("'request the VOE… and follow up with HR' are both work", () => {
    expect(many("request the VOE for the Johnson loan and follow up with HR on monday").map((d) => d.area)).toEqual(["work", "work"]);
  });

  it("'I forgot it at home' is a detail, not part of the title", () => {
    const d = one("turn in my anatomy homework I forgot it at home it was due friday");
    expect(d.title).toBe("Turn in my homework");
    expect(d.notes).toContain("I forgot it at home");
    expect(d.notes).toContain("It was due friday");
  });
  it("'at 2 30' is 2:30 PM", () => {
    expect(parse("dentist appointment on the 30th at 2 30", ctx).when?.time).toMatchObject({ hour: 14, minute: 30 });
  });

  it("a plain pair shares the day said at the end", () => {
    expect(many("clean my room and do laundry tonight")).toMatchObject([
      { title: "Clean my room", day: "2026-11-22" },
      { title: "Do laundry", day: "2026-11-22" },
    ]);
  });

  it("a context word said first isn't the title", () => {
    expect(many("so tomorrow after school I need to pick up my check from work and then go to the bank to deposit it")).toMatchObject([
      { title: "Pick up my check", day: "2026-11-23" },
      { title: "Go to the bank to deposit it" },
    ]);
  });
});

describe("words that only sound like something else", () => {
  it("real words are never 'fixed' into days or months", () => {
    for (const w of ["remember", "members", "protect", "match", "projects", "mondays", "product"]) {
      const d = parse(`${w} thing`, { ...ctx, spoken: true });
      expect(d.title.toLowerCase()).toContain(w);
    }
  });
  it("'the first half' isn't the 1st of the month", () => {
    expect(one("read the first half of chapter 2").day).toBeNull();
    expect(one("due on the first").day).toBe("2026-12-01");
  });
  it("past days aren't due dates", () => {
    expect(one("email Mr Lee about the quiz I missed on friday").day).toBeNull();
    expect(one("redo the worksheet I didn't finish on thursday").day).toBeNull();
    expect(one("turn in the worksheet on thursday").day).toBe("2026-11-26");
  });
});
