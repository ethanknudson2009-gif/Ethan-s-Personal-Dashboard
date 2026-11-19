/**
 * One long talk → many items.
 *
 * "Okay, for tomorrow: call Mike about the Johnson file, he wants the
 * appraisal. Then English essay due Friday, it needs to be five pages. Also
 * buy milk, eggs and bread, and pay the phone bill."
 *
 * becomes four items, each with its own title, date and notes:
 *   1. Call Mike about the Johnson file (tomorrow) · He wants the appraisal
 *   2. English: Essay (Fri) · Needs to be 5 pages
 *   3. Buy milk, eggs and bread (tomorrow)
 *   4. Pay the phone bill (tomorrow)
 *
 * How it decides:
 *  1. Find every place a new item *might* start: new lines, ";", "first /
 *     next / another thing", "also / then / plus", sentence ends, commas,
 *     "and", and a to-do verb ("call", "buy", "email"…) right after other words
 *     (speech often has no punctuation at all).
 *  2. Keep a cut only if the words after it look like their own item: they
 *     start with a to-do verb, name their own assignment and day, log money or
 *     food, and so on. Words like "it needs…", "make sure…", "he wants…" are
 *     details, so they stay with the item before as notes.
 *  3. Context said up front ("for tomorrow:", "for work") fills in what an
 *     item didn't say itself.
 */
import { parse, type CaptureDraft, type ParseContext } from "./index";
import { stripLeadIn } from "./notes";

export type ManyItem = { text: string; draft: CaptureDraft };

type Kind = "start" | "hard" | "list" | "sentence" | "weak" | "soft" | "verb";
type Cut = { at: number; end: number; kind: Kind };
const RANK: Record<Kind, number> = { start: 9, hard: 6, list: 5, sentence: 4, weak: 3, soft: 2, verb: 1 };

/** To-do verbs: a new item usually starts with one of these. */
const VERBS =
  "call|text|email|e-mail|buy|pick up|drop off|pay|book|schedule|return|clean|wash|finish|start|study|submit|turn in|send|order|cancel|renew|fix|meet with|meet up with|meet|go to|go get|get|grab|take out|mow|apply|sign up|register|print|fill out|write|work on|make(?! sure)|prep|meal prep|cook|do(?= (?:the|my|laundry|homework|dishes|a |an ))|water|feed|walk the|vacuum|organize|update|upload|deposit|transfer|reply to|respond to|message|dm|facetime|visit|drive|practice|memorize|read|finish up|wrap up|follow up with|follow up on|follow up|check on|check in with|look into|set up|clean up|put away|charge|refill|renew|book";
const VERB_START = new RegExp(`^(?:${VERBS})\\b`);
/** A verb followed by "him / it / that" points back at the item before ("call Mike and text him"). */
const POINTS_BACK = new RegExp(`^(?:${VERBS})(?:\\s+(?:up|off|out|back))?\\s+(?:him|her|them|it|that|this|those|these|back|again)\\b`);
/** Words that, right before a verb, mean it's not a new item ("need to call", "the email"). */
const NOT_BEFORE_VERB = new Set(
  (
    "the a an my your his her our their this that these those to in of for on at with from by about i we you he she they me him them us it " +
    "will can could should would must might gonna wanna gotta need needs have has had let's lets please not don't dont didn't never just " +
    "also then and or but so phone tax i'll we'll you'll can't won't who which to-do todo also and maybe probably really still even first"
  ).split(" "),
);
/** Nouns that make a verb word a noun instead ("book report", "study guide"). */
const NOT_AFTER_VERB = /^(?:report|guide|club|list|form|hall|session|log|notes|book|messages?|chain|thread|stub|stubs|slip|sheet)\b/;

/** Starts that are details about the item before, not a new item. */
const DETAIL_START =
  /^(?:it|it's|its|it'll|itll|that|that's|this|which|who|where|because|cause|cuz|since|so that|so it|so i can|so we can|but|though|although|and it|and that|make sure|be sure|remember|don'?t forget|dont forget|note|notes|details?|like|for example|including|include|with|about|needs?|has to|have to be|should be|must be|due|by|before|after|until|around|at|on|in|from|the teacher|my teacher|teacher|he|she|they|him|her|them|for|mike (?:said|says|wants|needs)|ask (?:him|her|them|about)|tell (?:him|her|them)|bring|only|just|at least|worth|page|pages|\d+\s*(?:pages?|sources?|words?|questions?|problems?|slides?|minutes?|paragraphs?)|chapter|ch\b|questions?|problems?|use|using|double|single|mla|apa|font|times new roman)\b/;

/** School things: with their own day or class they're their own item. */
const SCHOOL = /\b(essay|quiz|test|exam|midterm|final|homework|hw|lab|project|worksheet|assignment|paper|presentation|report|study guide|reading|discussion post|outline|journal|speech|packet)\b/;
/** Logging something that already happened: always its own item. */
const LOG_START = /^(?:i\s+)?(?:spent|paid|bought|got paid|venmo'?d|ate|had (?:a |an |some )?\w+ for (?:breakfast|lunch|dinner)|drank|ran|jogged|biked|swam|walked \d|did \d|worked out|went to the gym|lifted|benched|squatted)\b/;
/** Short "for tomorrow", "work stuff" openers that set context for every item. */
const CONTEXT_ONLY =
  /^(?:for |at |on |about |re )?(?:next |this |by )?(?:work|school|prmi|primary|the office|home|personal|today|tomorrow|tonight|this weekend|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|in the morning|in the afternoon|in the evening|this morning|this afternoon|this evening|tomorrow morning|tomorrow afternoon|tomorrow night|after school|after work|after class|before school|before work|at lunch|first thing(?: in the morning)?)(?: stuff| things| tasks| list| errands)?$/;
const INTRO_WORDS = /\b(?:things?|stuff|list|to[ -]?dos?|tasks?|errands|reminders?|a few|a bunch|a couple|a lot)\b/;
const SHOPPING = /^(?:buy|get|grab|pick up|order|go get)\b/;

const DATE_PREP = /^(?:on|at|by|in|for|before|after|until|from|due|around)\b/;

function findCuts(low: string): Cut[] {
  const cuts: Cut[] = [];
  const add = (at: number, end: number, kind: Kind) => cuts.push({ at, end, kind });

  // New lines and ";" (typed lists, pasted notes).
  for (const m of low.matchAll(/[ \t]*(?:\n+|;)\s*(?:[-*•·]\s*|\d+[.)]\s+)?/g)) add(m.index, m.index + m[0].length, "hard");
  // A list that starts on the first line with a bullet.
  const lead = /^\s*(?:[-*•·]\s*|\d+[.)]\s+)/.exec(low);
  if (lead) add(0, lead[0].length, "hard");

  // "first", "next", "another thing", "number two", "lastly"…
  const LIST =
    /(?<=^|[\s,.;:!?])()((?:and\s+)?(?:number\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)|first(?:ly)?(?:\s+off)?|second(?:ly)?|third(?:ly)?|fourth(?:ly)?|fifth(?:ly)?|next(?:\s+up|\s+thing(?:\s+is)?)?|after\s+that|another\s+thing(?:\s+is)?|one\s+more\s+thing(?:\s+is)?|the\s+other\s+thing(?:\s+is)?|last(?:ly|\s+thing(?:\s+is)?|\s+but\s+not\s+least)?|finally|and\s+lastly|and\s+finally))(?=[\s,:]|$)[\s,:]*/g;
  for (const m of low.matchAll(LIST)) {
    const after = low.slice(m.index + m[0].length);
    const word = m[2].replace(/^and\s+/, "");
    // "next friday", "first draft", "last week" are not list words.
    if (/^(?:next|last|first|second|third|fourth|fifth)$/.test(word) && /^(?:week|weekend|month|year|time|class|day|night|period|draft|page|chapter|semester|term|quarter|to\b|mon|tue|wed|thu|fri|sat|sun|thing\b(?! i))/.test(after)) continue;
    if (/\b(?:the|my|this|that|a|your|his|her|our)\s*$/.test(low.slice(0, m.index))) continue;
    const punctBefore = /[,.;:!?]\s*$/.test(low.slice(0, m.index));
    const commaAfter = /[,:]/.test(m[0].slice(m[1].length + m[2].length));
    const startOfText = m.index === 0;
    const strongAfter = VERB_START.test(stripLeadIn(after).toLowerCase()) || /^i\b/.test(after);
    if (startOfText || punctBefore || commaAfter || strongAfter || !/^(?:first|last)$/.test(word)) add(m.index + m[1].length, m.index + m[0].length, "list");
  }

  // "also", "then", "plus", "oh and", "and I also need to"…
  const WEAK =
    /(?<=^|[\s,.;:!?])()((?:and\s+)?(?:(?:okay|ok|alright|all\s+right)\s+and(?:\s+then|\s+also)?|then|also|plus|oh\s+and|oh\s+also|oh\s+yeah(?:\s+and)?|on\s+top\s+of\s+that|besides\s+that|i\s+also|in\s+addition))(?=[\s,:]|$)[\s,:]*/g;
  for (const m of low.matchAll(WEAK)) add(m.index + m[1].length, m.index + m[0].length, "weak");

  // Sentence ends (not "3.5" or "p.m."; the spoken cleanup already made those "pm").
  for (const m of low.matchAll(/(?<=[a-z0-9)"'])[.!?]+\s+/g)) add(m.index, m.index + m[0].length, "sentence");
  // A colon after a short opener: "Tomorrow: …", "Work stuff: …" (not "3:30", not "notes:").
  for (const m of low.matchAll(/:\s+/g)) {
    const before = low.slice(0, m.index);
    if (/\bnotes?$|\bdetails?$/.test(before)) continue;
    add(m.index, m.index + m[0].length, "list");
  }
  // Commas and "and".
  for (const m of low.matchAll(/,\s*(?:and\s+)?/g)) add(m.index, m.index + m[0].length, "soft");
  for (const m of low.matchAll(/\s+and\s+/g)) add(m.index, m.index + m[0].length, "soft");
  // A to-do verb right after other words, with no punctuation: "call mike tomorrow buy milk".
  for (const m of low.matchAll(new RegExp(`(\\S+)(\\s+)(?=(?:${VERBS})\\b)`, "g"))) {
    const prev = m[1].replace(/[^a-z0-9'-]/g, "");
    const at = m.index + m[1].length;
    const rest = low.slice(at + m[2].length);
    const verb = new RegExp(`^(?:${VERBS})\\b\\s*`).exec(rest);
    if (!prev || NOT_BEFORE_VERB.has(prev) || /[,.;:!?]$/.test(m[1])) continue;
    if (verb && NOT_AFTER_VERB.test(rest.slice(verb[0].length))) continue;
    add(at, at + m[2].length, "verb");
  }

  // Merge cuts that touch or overlap; the strongest kind wins.
  cuts.sort((a, b) => a.at - b.at || b.end - a.end);
  const merged: Cut[] = [];
  for (const c of cuts) {
    const last = merged[merged.length - 1];
    if (last && c.at <= last.end) {
      last.end = Math.max(last.end, c.end);
      if (RANK[c.kind] > RANK[last.kind]) last.kind = c.kind;
    } else merged.push({ ...c });
  }
  return merged;
}

type Piece = { text: string; kind: Kind; sep: string };

function pieces(text: string): Piece[] {
  const low = text.toLowerCase();
  const out: Piece[] = [];
  let pos = 0;
  let kind: Kind = "start";
  let sep = "";
  for (const c of findCuts(low)) {
    if (c.at > pos || out.length === 0) out.push({ text: text.slice(pos, c.at), kind, sep });
    pos = c.end;
    kind = c.kind;
    sep = text.slice(c.at, c.end);
  }
  out.push({ text: text.slice(pos), kind, sep });
  return out.filter((p) => p.text.trim().length > 0);
}

const hasOwnDay = (text: string, ctx: ParseContext) => Boolean(parse(text, ctx).when);

function clean(text: string): string {
  let s = text.trim().replace(/^[\s,.;:!?–—-]+/, "");
  for (let guard = 0; guard < 4; guard++) {
    const before = s;
    s = stripLeadIn(s.replace(/^(?:and|but|okay and|ok and|so and)\s+/i, ""));
    if (s === before) break;
  }
  return s.toLowerCase();
}

/** "I also need to…", "and I have to…": announces a new thing to do. */
const ANNOUNCED = /^(?:(?:and|okay|ok|so|then|also)\s+)*(?:i\s+(?:also\s+)?(?:need|have|gotta|got|should|must|want)\s+to|i'?ve\s+(?:also\s+)?got\s+to|i\s+(?:also\s+)?gotta)\b/i;

type Built = { text: string; viaComma: boolean };

/** Splits a long message into the texts of separate items (one item → one entry). */
export function splitItems(rawText: string, ctx: ParseContext): { items: string[]; intro: string | null } {
  const text = rawText.trim();
  if (!text) return { items: [], intro: null };
  const whole = parse(text, ctx);
  const lowWhole = text.toLowerCase();
  // A whole workout ("bench 3x10 at 135 then incline…") or a journal entry stays one thing.
  const gymTalk = /\d+\s*x\s*\d+|\bsets?\s+of\b|\b(?:chest|back|leg|legs|arm|shoulder|push|pull)\s+day\b/.test(lowWhole);
  if (whole.type === "note" || (whole.type === "workout" && gymTalk) || /^\s*(?:note|journal)\b/i.test(text)) return { items: [text], intro: null };

  const ps = pieces(text);
  const items: Built[] = [];
  let intro: string | null = null;
  let listMode = false;

  // "Okay here's my list for tomorrow" said without a pause: split the opener off.
  const opener = /^\s*(?:(?:okay|ok|so|alright|um|uh|real quick)[\s,]+)*(?:(?:here'?s|here is|this is|these are)\s+(?:my|the|a)\s+(?:list|to[ -]?do list|to[ -]?dos|stuff|things|tasks|errands)|(?:i have|i've got|i got|i've|there are|there's|we have|got)\s+(?:like\s+|so\s+)?(?:a few|a bunch of|a couple(?: of)?|a lot of|a ton of|tons of|so much|some|several|lots of|\d+|two|three|four|five|six)\s+(?:things|stuff|tasks|errands|items|homework|assignments|work stuff|school stuff)(?:\s+(?:to do|i need to do|to get done|i have to do|on my list))?)(?:\s+(?:for|from)?\s*(?:today|tomorrow|tonight|this week|next week|work|school|the week|monday|tuesday|wednesday|thursday|friday|saturday|sunday))?[\s:,.-]*/i.exec(
    ps[0]?.text ?? "",
  );
  if (opener && ps[0].text.length > opener[0].length) {
    const restText = ps[0].text.slice(opener[0].length);
    ps.splice(0, 1, { text: opener[0], kind: "start", sep: "" }, { text: restText, kind: "list", sep: ": " });
  }

  /** Only warm-up words ("real quick", "okay so")? */
  const isFiller = (t: string) => stripLeadIn(`${t} zqx`, { context: false }).trim().toLowerCase() === "zqx";
  /** Only a day ("next friday", "tomorrow"), carried onto the next piece. */
  let carry = "";
  /** A skipped filler piece ("Okay") keeps the strength of the cut before it. */
  let carryKind: Kind | null = null;

  ps.forEach((p, i) => {
    if (isFiller(p.text)) {
      if (p.kind !== "start" && (!carryKind || RANK[p.kind] > RANK[carryKind])) carryKind = p.kind;
      return;
    }
    if (carryKind) {
      if (RANK[carryKind] > RANK[p.kind]) p = { ...p, kind: carryKind };
      carryKind = null;
    }
    if (carry) {
      p = { ...p, text: `${carry} ${p.text.trim()}` };
      carry = "";
    }
    const s = clean(p.text);
    if (i > 0 && i < ps.length - 1 && CONTEXT_ONLY.test(s.replace(/[:,.]$/, "")) && p.kind !== "hard") {
      carry = p.text.trim();
      return;
    }
    const words = s.split(/\s+/).filter(Boolean).length;

    // The opener: "Okay so here's my list for tomorrow:", "For work:", "Tomorrow".
    if (i === 0 && ps.length > 1 || (items.length === 0 && intro === null && i > 0 && ps.slice(0, i).every((q) => isFiller(q.text)))) {
      const next = ps[1];
      const colon = /:/.test(next.sep) && words <= 8;
      const contextOnly = CONTEXT_ONLY.test(s.replace(/[:,.]$/, ""));
      const introWords = INTRO_WORDS.test(s) && !VERB_START.test(s) && !SCHOOL.test(s) && words <= 14;
      if (colon || contextOnly || introWords) {
        intro = p.text.trim();
        listMode = true;
        return;
      }
    }

    const prev = items[items.length - 1];
    if (!prev) {
      items.push({ text: p.text.trim(), viaComma: false });
      return;
    }
    const prevLow = prev.text.toLowerCase();
    const prevStart = clean(prev.text);

    // What do the words after the cut look like?
    const detail = DETAIL_START.test(s) || /^\d/.test(s);
    const verb = VERB_START.test(s) && !POINTS_BACK.test(s);
    const log = LOG_START.test(s);
    let schoolOwn = false;
    let dated = false;
    if (!detail && !verb && !log) {
      const d = parse(p.text, ctx);
      const sw = SCHOOL.exec(s)?.[1];
      schoolOwn = Boolean(sw && (d.when || d.classId) && (!new RegExp(`\\b${sw}\\b`).test(prevLow) || (d.classId && d.classId !== parse(prev.text, ctx).classId)));
      dated = Boolean(d.when) && !DATE_PREP.test(s) && words >= 2;
    }
    const looksNew = verb || log || schoolOwn || dated;
    const shoppingMore = SHOPPING.test(prevStart) && !verb && !log && !dated && words <= 3 && !detail;

    let isNew: boolean;
    switch (p.kind) {
      case "hard":
      case "list":
        isNew = !detail || verb;
        break;
      case "sentence":
      case "weak":
        isNew = looksNew;
        break;
      case "soft":
        // After a comma: a to-do verb is enough. After a bare "and", the two
        // usually belong together ("call the dentist and schedule a cleaning")
        // unless the second part has its own day or is something else entirely.
        isNew = /,/.test(p.sep)
          ? looksNew || (listMode && !detail && !shoppingMore && words >= 1)
          : log || schoolOwn || (verb && (ANNOUNCED.test(p.text.trim()) || hasOwnDay(p.text, ctx)));
        break;
      default: // "verb": only when a to-do verb really starts a new thing ("choir practice" is a noun)
        isNew = verb && i > 0 && clean(ps[i - 1].text).split(/\s+/).filter(Boolean).length >= 2;
    }

    if (isNew) {
      items.push({ text: p.text.trim(), viaComma: p.kind === "soft" });
      if (p.kind === "soft" || p.kind === "verb") listMode = listMode || p.kind === "soft";
    } else if (p.kind === "soft" || p.kind === "verb") {
      // Not a new item: put the words back exactly as they were said.
      prev.text = `${prev.text}${p.sep}${p.text.trim()}`;
    } else {
      // A detail: becomes a note on the item before.
      prev.text = `${prev.text.replace(/[\s,;:]+$/, "")}. ${p.text.trim()}`;
    }
  });

  if (!items.length && intro) return { items: [intro], intro: null };
  return { items: items.map((b) => b.text), intro };
}

/** Parse a long message into one draft per item, sharing context said up front. */
export function parseMany(rawText: string, ctx: ParseContext): ManyItem[] {
  const { items, intro } = splitItems(rawText, ctx);
  const introDraft = intro ? parse(intro, ctx) : null;
  const introLow = stripLeadIn(intro ?? "", { context: false }).toLowerCase();
  // "for work:", "work stuff" → work; "after school" is only a time, not school work.
  const introArea = /(?:^|\b(?:for|at)\s+)(?:work|the office)\b|\b(?:prmi|primary)\b/.test(introLow)
    ? "work"
    : /(?:^|\bfor\s+)school\b/.test(introLow)
      ? "school"
      : null;
  const out: ManyItem[] = [];
  for (const text of items) {
    const draft = parse(text, ctx);
    if (introDraft?.when && (!draft.when || draft.whenFromNotes) && (draft.type === "task" || draft.type === "homework")) {
      draft.when = introDraft.when;
      draft.problems = draft.problems.filter((x) => x !== "No due date found" && !x.startsWith("Couldn't tell"));
    }
    if (introDraft?.classId && !draft.classId && (draft.type === "task" || draft.type === "homework")) {
      draft.classId = introDraft.classId;
      draft.className = introDraft.className;
      draft.type = "homework";
      draft.area = "school";
      draft.problems = draft.problems.filter((x) => x !== "No class matched" && !x.includes("Which class"));
    }
    if (introArea && draft.area === "personal" && !draft.classId) draft.area = introArea;
    // "English essay due Friday and a quiz Monday": the quiz is for English too.
    const before = out[out.length - 1]?.draft;
    if (before?.classId && !draft.classId && draft.type === "homework" && !draft.problems.some((x) => x.includes("Which class"))) {
      draft.classId = before.classId;
      draft.className = before.className;
      draft.problems = draft.problems.filter((x) => x !== "No class matched");
    }
    out.push({ text, draft });
  }
  return out;
}
