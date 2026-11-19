/**
 * Our own natural-language parser: no paid AI involved.
 *
 *   parse("bio lab due Fri 11:59pm", ctx)
 *   → homework · "Lab" · Biology · due Fri Nov 13 11:59 PM
 *
 * It's used by the quick-add box, by /api/capture when only raw text
 * arrives, and to check the date words Claude sends. Everything is a pure
 * function of (text, now, settings), so it's fully tested.
 * See docs/07-architecture.md §7.
 */
import { parseWhen, type ParsedWhen } from "./dates";
import { SpanTracker } from "./spans";
import { editDistance, normalizeSpoken, tolerance } from "./spoken";

export type CaptureType = "homework" | "task" | "food" | "workout" | "expense" | "note" | "habit";

export type ClassRef = { id: string; name: string; shortNames?: string[] };

export type ParseContext = {
  now: Date;
  timeZone: string;
  /** True when the text came from speech-to-text: tidy fillers, spoken numbers and near-miss words first. */
  spoken?: boolean;
  classes?: ClassRef[];
  habits?: string[];
};

export type WorkoutSets = { sets: number; reps: number; weightLb: number | null };

export type CaptureDraft = {
  type: CaptureType;
  title: string;
  rawText: string;
  when: ParsedWhen | null;
  classId: string | null;
  className: string | null;
  /** Dollars, for money spent or received. */
  amount: number | null;
  /** A count, e.g. "2 eggs" → 2. */
  quantity: number | null;
  /** Time estimate (homework/tasks) or duration (workouts), in minutes. */
  minutes: number | null;
  sets: WorkoutSets | null;
  distanceMiles: number | null;
  /** Expense category, e.g. "gas". */
  category: string | null;
  habitName: string | null;
  /** Food: calories and grams of protein, if said ("700 calories", "30g protein"). */
  calories: number | null;
  proteinG: number | null;
  /** Journal: how the day felt, 1 (rough) to 5 (great), from words like "great" or "rough". */
  mood: number | null;
  /** "every Monday", "daily", "every other week", "monthly". */
  repeat: "daily" | "weekly" | "biweekly" | "monthly" | null;
  /** Money coming in ("got paid $400", "paycheck") rather than spent. */
  incoming: boolean;
  /** Extra context said after the main thing ("it needs to be 3 pages…"), shown as a caption. */
  notes: string | null;
  /** Which part of life it belongs to: a class → school; "at work"/"PRMI" → work. */
  area: Area;
  /** 0–1. Below the Inbox threshold, or with problems, it goes to review. */
  confidence: number;
  /** Plain-language reasons we're unsure, shown on the review card. */
  problems: string[];
};

export type Area = "school" | "work" | "personal";

// ── Work (Ethan's job at PRMI) ─────────────────────────────────────────────
/** Phrases that say a task is for work. These words are removed from the title. */
// Ethan calls PRMI "work", "primary" (also how speech often hears "PRMI")
// or "the office". Mike is his LO (loan officer), so mentioning Mike means work.
const WORK_TAGS = /\b(?:at|for|from|to) (?:work|prmi|primary|the office)\b|\bprmi\b|^(?:work|primary|the office)\b:?/g;
/** Words that suggest work but stay in the title ("send Mike the files"). */
const WORK_HINTS =
  /\b(shift|my boss|manager|coworkers?|clock (?:in|out)|timesheet|prmi|at work|for work|from work|to work|the office|mike|my lo|loan officer|loans?|loan files?|borrowers?|closing|closings|underwriting|underwriter|appraisals?|disclosures?|escrow|title company|pre-?approvals?|preapproval letter|rate locks?|lock the rate|refi|refinance|conditions|voe|1003|loan estimate|closing disclosure|processor|realtors?|pipeline|encompass|credit pull|pull credit|paystubs?|w-?2s?|bank statements?)\b|^(?:work|primary)\b/;

// ── Notes: where the main thing ends and extra context begins ─────────────
const NOTE_MARKERS =
  /(?:[,.;:!?]\s*|\s)(?=(?:notes?\s*:|note that|it needs|it has to|it should|it'?s about|it is about|make sure|remember|don'?t forget|because|so that|(?:the )?teacher said|(?:she|he|they) said|also|and also|bring|include|including|it covers|it'?s on|it is on|it'?s worth|i need to|i have to|i should|details?\s*:)\b)/g;

/** Where notes start in the text, or -1. The main part keeps at least 2 words. */
export function findNotesStart(low: string): number {
  const enoughBefore = (i: number) => low.slice(0, i).trim().split(/\s+/).filter(Boolean).length >= 2;
  const candidates: number[] = [];
  for (const m of low.matchAll(NOTE_MARKERS)) if (enoughBefore(m.index)) candidates.push(m.index);
  // A new sentence also starts notes: "Speech outline due Thursday. Three pages."
  for (const m of low.matchAll(/[.!?]\s+(?=\S)/g)) if (enoughBefore(m.index)) candidates.push(m.index);
  return candidates.length ? Math.min(...candidates) : -1;
}

/** Tidy the notes text: drop the leading punctuation and "note:" label, capitalize. */
function cleanNotes(text: string): string | null {
  const t = text
    .replace(/^[\s,.;:!?–-]+/, "")
    .replace(/^(?:notes?\s*:?|note that)\s*/i, "")
    .replace(/[\s,;:–-]+$/, "")
    .trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── Keyword lists ───────────────────────────────────────────────────────────
const NOTE_PREFIX = /^\s*(note|journal|remember that)\b\s*[:\-–]?\s*/i;
const EXPENSE_VERBS = /\b(spent|spend|paid|pay|bought|buy|cost|costs|venmo'?d|venmoed|zelled|zelle'?d|cash ?app'?d|cash ?apped|sent)\b/;
/** Money already gone ("spent", "paid", "venmo'd"): spending even without a $ sign. Future "pay the bill" stays a task. */
const SPENT_VERBS = /\b(spent|paid|bought|cost|costs|venmo'?d|venmoed|zelled|zelle'?d|cash ?app'?d|cash ?apped)\b/;
/** Money coming in (saved to Money as income). */
const INCOME_WORDS = /\b(got paid|get paid|paid me|paycheck|payday|got \$?\d|received \$?\d|earned|refund(?:ed)?|direct deposit|venmo'?d me|sent me)\b/;
const FOOD_WORDS = /\b(ate|eat|eating|drank|drink|breakfast|lunch|dinner|snack|calories|cals?|kcal|protein)\b/;
const WORKOUT_WORDS =
  /\b(gym|workout|worked out|lift|lifted|bench|squat|squats|deadlift|deadlifts|ran|run|jog|jogged|miles?|sets?|reps?|push-?ups?|pull-?ups?|curls?|cardio|swim|swam|bike|biked|hiked?|hiking|rowed|elliptical|treadmill|stairmaster|leg day|arm day|chest day|back day|push day|pull day)\b|\b\d+\s*x\s*\d+\b/;
/** "I feel great today", "today was rough": a journal line. */
const JOURNAL_START = /^(?:i feel|i'?m feeling|i felt|feeling|today was|today i|tonight i|dear diary|mood\b|my day was|had a (?:good|great|rough|bad|long|productive) day)/;
/** Mood words scored 1 (rough) to 5 (great). */
const MOOD_WORDS: [RegExp, number][] = [
  [/\b(terrible|awful|horrible|miserable|depressed|the worst|really bad|sad|rough|bad)\b/, 1],
  [/\b(meh|tired|exhausted|stressed|anxious|bored|blah|not great|kinda bad)\b/, 2],
  [/\b(okay|ok|fine|alright|all right|average|normal|so-so)\b/, 3],
  [/\b(good|productive|happy|nice|solid|chill|relaxed|calm)\b/, 4],
  [/\b(great|amazing|awesome|fantastic|incredible|excellent|best|perfect|on fire)\b/, 5],
];
/** School subjects people say instead of the class name ("math" → College Algebra). */
const SUBJECTS: Record<string, string[]> = {
  math: ["algebra", "calculus", "geometry", "trig", "statistics", "math", "precalc"],
  maths: ["algebra", "calculus", "geometry", "trig", "statistics", "math"],
  bio: ["biology", "anatomy", "physiology"],
  science: ["biology", "anatomy", "chemistry", "physics", "science"],
  english: ["english", "literature", "writing", "composition"],
  cad: ["autocad", "cad ", "drafting"],
  drafting: ["autocad", "drafting"],
  singing: ["choir", "chorus", "music"],
  music: ["choir", "chorus", "music", "band"],
  bible: ["church", "religion", "bible", "scripture"],
  religion: ["church", "religion"],
  seminary: ["church", "religion"],
  ai: ["ai ", "artificial", "mastermind"],
};
const SCHOOL_WORDS =
  /\b(homework|hw|essay|lab|quiz|test|exam|midterm|final|project|worksheet|assignment|chapter|ch|reading|study|paper|presentation|report)\b/;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, dozen: 12,
};

/** Words that carry no meaning once the date/amount/class are pulled out. */
const FILLER = new Set([
  "due", "by", "on", "at", "for", "is", "it's", "its", "i", "need", "to", "have", "has", "the", "about", "around",
  "~", "@", "and", "&", "of", "a", "an",
]);
/** Verbs dropped from the start of the title for these types ("ate eggs" → "Eggs"). */
const LEAD_VERBS: Partial<Record<CaptureType, RegExp>> = {
  food: /^(ate|eat|eating|drank|drink|had)\b/,
  expense: /^(spent|spend|paid|pay|bought|buy|venmo'?d|venmoed|zelled|zelle'?d|sent)\b/,
  workout: /^(i did|i went|i worked out|did|went|worked out)\b/,
  habit: /^(did my|did)\b/,
};

const clamp01 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Find the class a sentence mentions, by full name, nickname, or a 3+ letter
 * start of a word in its name ("anat" → Human Anatomy). If a word fits more
 * than one class ("history" → World History and Church History), we don't
 * guess: we return the problem so the Inbox can ask.
 */
function matchClass(
  low: string,
  spans: SpanTracker,
  classes: ClassRef[],
): { cls: ClassRef | null; problem: string | null } {
  // 1) Exact name or nickname, longest first so "ap bio" beats "bio".
  const candidates = classes
    .flatMap((c) => [c.name, ...(c.shortNames ?? [])].map((n) => ({ c, n: n.toLowerCase().trim() })))
    .filter((x) => x.n.length > 0)
    .sort((a, b) => b.n.length - a.n.length);
  for (const { c, n } of candidates) {
    const m = spans.free(new RegExp(`\\b${escapeRe(n)}\\b`, "g"), low)[0];
    if (m) {
      spans.claim(m.index, m.index + m[0].length);
      return { cls: c, problem: null };
    }
  }
  // 2) Close-enough matches, for misheard speech: "and atomy" → anatomy,
  //    "auto cad" → autocad, "master mind" → AI Mastermind. We join 1–3
  //    neighboring words and compare them to each name, nickname and long word
  //    of a class name, forgiving about 1 mistake per 5 letters.
  {
    const words = [...low.matchAll(/[a-z0-9']+/g)].filter((m) => !spans.isTaken(m.index, m.index + m[0].length));
    const targets = classes.flatMap((c) =>
      [c.name, ...(c.shortNames ?? []), ...c.name.split(/\s+/)]
        .map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((n) => n.length >= 5)
        .map((n) => ({ c, n })),
    );
    let best: { c: ClassRef; start: number; end: number; d: number; joined: string } | null = null;
    for (let i = 0; i < words.length; i++) {
      for (let len = 1; len <= 3 && i + len <= words.length; len++) {
        const joined = words
          .slice(i, i + len)
          .map((w) => w[0])
          .join("");
        if (joined.length < 5 || FILLER.has(joined)) continue;
        for (const t of targets) {
          if (Math.abs(t.n.length - joined.length) > 2) continue;
          const d = editDistance(joined, t.n);
          if (d <= tolerance(t.n.length) && (!best || d < best.d)) {
            const last = words[i + len - 1];
            best = { c: t.c, start: words[i].index, end: last.index + last[0].length, d, joined };
          }
        }
      }
    }
    if (best) {
      // Don't guess between two classes that fit equally well ("history").
      const found = best;
      const ties = new Set(targets.filter((t) => editDistance(found.joined, t.n) === found.d).map((t) => t.c.id));
      if (ties.size === 1) {
        spans.claim(found.start, found.end);
        return { cls: found.c, problem: null };
      }
    }
  }

  // 3) A subject word: "math" → College Algebra (only if exactly one class fits).
  for (const m of spans.free(/\b[a-z]{2,}\b/g, low)) {
    const options = SUBJECTS[m[0]];
    if (!options) continue;
    const fits = classes.filter((cl) => options.some((o) => `${cl.name.toLowerCase()} `.includes(o)));
    if (fits.length === 1) {
      spans.claim(m.index, m.index + m[0].length);
      return { cls: fits[0], problem: null };
    }
  }

  // 4) A word that is the start of a word in a class name: "anat" → "Human Anatomy".
  for (const m of spans.free(/\b[a-z]{3,}\b/g, low)) {
    const word = m[0];
    if (FILLER.has(word)) continue;
    const fits = classes.filter((cl) => cl.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(word)));
    if (fits.length === 1) {
      spans.claim(m.index, m.index + word.length);
      return { cls: fits[0], problem: null };
    }
    if (fits.length > 1) {
      const names = fits.map((c) => c.name);
      const list = `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
      return { cls: null, problem: `"${word}" could be ${list}. Which class?` };
    }
  }
  return { cls: null, problem: null };
}

/** Rough word stem so "meditated" matches "Meditate" and "reading" matches "Reading". */
function stem(w: string): string {
  return w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "").replace(/e$/, "") : w;
}

/** The habit a sentence mentions: every word of its name (by stem) appears. Longest name wins. */
export function findHabit(low: string, habits: string[]): string | null {
  const said = new Set((low.match(/[a-z0-9']+/g) ?? []).map(stem));
  const fits = habits.filter((h) => {
    const words = (h.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !FILLER.has(w) && w !== "my");
    return words.length > 0 && words.every((w) => said.has(stem(w)));
  });
  return fits.sort((a, b) => b.length - a.length)[0] ?? null;
}

function detectType(low: string, ctx: ParseContext, isNote: boolean): CaptureType | null {
  if (isNote || JOURNAL_START.test(low)) return "note";
  // Money in or out ("got paid $400" is income; "spent $12" is spending).
  if ((INCOME_WORDS.test(low) || EXPENSE_VERBS.test(low)) && /\$\s?\d|\d\s*(?:dollars|bucks)\b/.test(low)) return "expense";
  if (INCOME_WORDS.test(low) && /\d/.test(low)) return "expense";
  if (SPENT_VERBS.test(low)) return "expense";
  // A habit you named ("did my reading", "drank water"), unless there are sets or calories to log.
  // ("church history reading due wed" is homework: a class or "due" wins over the habit.)
  const saysClass = (ctx.classes ?? []).some((c) =>
    c.name.toLowerCase().split(/\s+/).some((w) => w.length >= 4 && low.includes(w)),
  );
  if (
    findHabit(low, ctx.habits ?? []) &&
    !saysClass &&
    !/\bdue\b|\bevery\b|\bdaily\b|\bweekly\b|\bmonthly\b|\d+\s*x\s*\d+|\bsets?\b|calories|cals?\b|kcal/.test(low)
  )
    return "habit";
  if (FOOD_WORDS.test(low)) return "food";
  if (WORKOUT_WORDS.test(low)) return "workout";
  if (/\$\s?\d/.test(low)) return "expense";
  if (SCHOOL_WORDS.test(low)) return "homework";
  return null; // decided later (a class match makes it homework, otherwise task)
}

function cleanTitle(leftover: string, type: CaptureType): string {
  let words = leftover
    .replace(/[,;!?]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w$#'"]+|[^\w'"]+$/g, ""))
    .filter((w) => w.length > 0);
  const lead = LEAD_VERBS[type];
  while (words.length > 0 && lead && lead.test(words.slice(0, 2).join(" ").toLowerCase())) {
    const m = words.slice(0, 2).join(" ").toLowerCase().match(lead)!;
    words = words.slice(m[0].split(" ").length);
  }
  // Drop filler words at the start and end, and "due"/"by" anywhere.
  words = words.filter((w) => !["due", "by"].includes(w.toLowerCase()));
  while (words.length && FILLER.has(words[0].toLowerCase())) words.shift();
  while (words.length && FILLER.has(words[words.length - 1].toLowerCase())) words.pop();
  // Speech arrives lowercase: give names we know their capitals back.
  const title = words.join(" ").replace(PROPER_NAMES, (w) => PROPER[w.toLowerCase()] ?? w);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** People and places Ethan mentions (Mike is his loan officer at PRMI). */
const PROPER: Record<string, string> = { mike: "Mike", prmi: "PRMI", lo: "LO" };
const PROPER_NAMES = /\b(mike|prmi|lo)\b/gi;

const DEFAULT_TITLES: Record<CaptureType, string> = {
  homework: "Homework", task: "Task", food: "Food", workout: "Workout",
  expense: "Expense", note: "Note", habit: "Habit",
};

export function parse(rawText: string, ctx: ParseContext): CaptureDraft {
  // Same length for both, so match positions line up for building the title.
  let original = (ctx.spoken ? normalizeSpoken(rawText) : rawText).trim().replace(/\s+/g, " ");
  const noteMatch = NOTE_PREFIX.exec(original);
  if (noteMatch) original = original.slice(noteMatch[0].length);
  const low = original.toLowerCase();

  const spans = new SpanTracker();
  const problems: string[] = [];
  let confidence = 1;

  const type0 = detectType(low, ctx, Boolean(noteMatch));

  // Notes keep their words exactly; we don't pull dates or amounts out of them.
  if (type0 === "note") {
    return {
      ...emptyDraft("note", rawText),
      title: original ? restoreCase(original.charAt(0).toUpperCase() + original.slice(1), rawText) : DEFAULT_TITLES.note,
      mood: moodOf(low),
      confidence: 1,
    };
  }

  // ── Repeat: "every monday", "daily", "every other week" ─────────────────
  let repeat: CaptureDraft["repeat"] = null;
  {
    const r = spans.free(
      /\b(every\s+other\s+week|every\s+two\s+weeks|biweekly|bi-weekly|every\s+(?:day|morning|night|evening)|each\s+day|daily|every\s+week|weekly|every\s+month|monthly|each\s+month)\b|\b(every|each)(?=\s+(?:mon|tue|wed|thu|fri|sat|sun))/g,
      low,
    )[0];
    if (r) {
      const w = r[0];
      repeat = /other|two|bi/.test(w) ? "biweekly" : /day|morning|night|evening|daily/.test(w) ? "daily" : /month/.test(w) ? "monthly" : "weekly";
      spans.claim(r.index, r.index + r[0].length);
    }
  }

  // ── Money: "$12", "$12.50", "12 dollars" ─────────────────────────────────
  let amount: number | null = null;
  const money = spans.free(/\$\s?(\d+(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s*(?:dollars|bucks)\b/g, low)[0];
  if (money) {
    amount = Number(money[1] ?? money[2]);
    spans.claim(money.index, money.index + money[0].length);
  }

  // ── Workout sets: "3x10 @135", "3 sets of 10 at 135 lbs" ────────────────
  let sets: WorkoutSets | null = null;
  const setsMatch = spans.free(
    /\b(\d+)\s*x\s*(\d+)(?:\s*(?:@|at)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds)?)?|\b(\d+)\s+sets?\s+of\s+(\d+)(?:\s+(?:reps?\s+)?(?:@|at)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds)?)?/g,
    low,
  )[0];
  if (setsMatch) {
    sets = {
      sets: Number(setsMatch[1] ?? setsMatch[4]),
      reps: Number(setsMatch[2] ?? setsMatch[5]),
      weightLb: setsMatch[3] ?? setsMatch[6] ? Number(setsMatch[3] ?? setsMatch[6]) : null,
    };
    spans.claim(setsMatch.index, setsMatch.index + setsMatch[0].length);
    // Weight said somewhere else: "3 sets of 8 squats at 185 pounds", "@135".
    if (sets.weightLb === null) {
      const w = spans.free(/(?:@|\bat)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds)?\b(?!\s*(?:am|pm|:))|\b(\d+(?:\.\d+)?)\s*(?:lbs?|pounds)\b/g, low)[0];
      if (w && (w[0].startsWith("@") || /lb|pound/.test(w[0]) || type0 === "workout")) {
        sets.weightLb = Number(w[1] ?? w[2]);
        spans.claim(w.index, w.index + w[0].length);
      }
    }
  }

  // ── Distance: "2.5 miles", "5k" ─────────────────────────────────────────
  let distanceMiles: number | null = null;
  const dist = spans.free(/\b(\d+(?:\.\d+)?)\s*(miles?|mi|km|k)\b/g, low)[0];
  if (dist && (type0 === "workout" || type0 === null)) {
    const n = Number(dist[1]);
    distanceMiles = dist[2] === "km" || dist[2] === "k" ? Math.round(n * 0.621371 * 100) / 100 : n;
    spans.claim(dist.index, dist.index + dist[0].length);
  }

  // ── Duration / estimate: "about 2 hours", "45 min", "1.5 hrs" ────────────
  let minutes: number | null = null;
  const dur = spans.free(
    /\b(?:(?:about|around|takes?|for|in)\s+|~\s*)?(\d+(?:\.\d+)?|an?|half an?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min)\b/g,
    low,
  )[0];
  if (dur) {
    const n = dur[1].startsWith("half") ? 0.5 : /^an?$/.test(dur[1]) ? 1 : Number(dur[1]);
    minutes = Math.round(dur[2].startsWith("h") ? n * 60 : n);
    spans.claim(dur.index, dur.index + dur[0].length);
  }

  // ── Date & time ───────────────────────────────────────────────────────────
  const dateResult = parseWhen(low, spans, ctx.now, ctx.timeZone);
  problems.push(...dateResult.problems);
  confidence -= dateResult.penalty;
  const when = dateResult.when;

  // ── Money said without "$": "got paid 450", "venmo'd jake 15" ───────────
  if (amount === null && type0 === "expense") {
    const bare = spans.free(/\b(\d+(?:\.\d{1,2})?)\b(?![:\d]|\s*(?:x|%|lbs?|pounds|miles?|mi|min|mins|minutes?|hours?|hrs?|calories|cals?|st|nd|rd|th)\b)/g, low)[0];
    if (bare) {
      amount = Number(bare[1]);
      spans.claim(bare.index, bare.index + bare[0].length);
    }
  }

  // ── Food: "700 calories", "30g protein" ─────────────────────────────────
  let calories: number | null = null;
  let proteinG: number | null = null;
  if (type0 === "food") {
    const cal = spans.free(/\b(?:about\s+|around\s+|~\s*)?(\d{1,4})\s*(?:calories|cals?|kcal)\b/g, low)[0];
    if (cal) {
      calories = Number(cal[1]);
      spans.claim(cal.index, cal.index + cal[0].length);
    }
    const pro = spans.free(/\b(\d{1,3})\s*(?:g|grams?)\s*(?:of\s+)?protein\b|\bprotein\s*(\d{1,3})\s*(?:g|grams?)?\b/g, low)[0];
    if (pro) {
      proteinG = Number(pro[1] ?? pro[2]);
      spans.claim(pro.index, pro.index + pro[0].length);
    }
  }

  // ── Class ────────────────────────────────────────────────────────────────
  let cls: ClassRef | null = null;
  let classProblem: string | null = null;
  if (type0 === null || type0 === "homework") {
    ({ cls, problem: classProblem } = matchClass(low, spans, ctx.classes ?? []));
  }

  // ── Final type ───────────────────────────────────────────────────────────
  let type: CaptureType;
  if (type0) type = type0;
  else if (cls) type = "homework";
  else {
    type = "task";
    if (!when) {
      // Nothing told us what this is. A plain to-do is the safest guess.
      problems.push("Couldn't tell what kind of item this is, so it's a task");
      confidence -= 0.4;
    }
  }

  // ── Habit name ───────────────────────────────────────────────────────────
  let habitName: string | null = null;
  if (type === "habit") {
    habitName = findHabit(low, ctx.habits ?? []);
  }

  // ── Quantity: "2 eggs", "two slices" (food, mainly) ─────────────────────
  let quantity: number | null = null;
  if (type === "food") {
    const q = spans.free(/\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|half|dozen)\b(?=\s+[a-z])/g, low)[0];
    if (q) {
      quantity = /^\d/.test(q[1]) ? Number(q[1]) : NUMBER_WORDS[q[1]];
      spans.claim(q.index, q.index + q[0].length);
    }
  }

  // ── Money in or out ─────────────────────────────────────────────────────
  const incoming = type === "expense" && INCOME_WORDS.test(low);
  if (incoming) {
    // "got paid" / "paycheck" says the direction; keep it out of the title.
    for (const m of spans.free(/\b(?:got paid|get paid|paid me|got|received|earned)\b(?:\s+(?:for|from))?/g, low)) spans.claim(m.index, m.index + m[0].length);
  }

  // ── Work or school? ──────────────────────────────────────────────────────
  const isWork = WORK_HINTS.test(low) || /\bprmi\b/.test(low);
  if (isWork) {
    // "at work" / "for PRMI" just say where it belongs: keep them out of the title.
    for (const m of spans.free(WORK_TAGS, low)) spans.claim(m.index, m.index + m[0].length);
  }
  const area: Area = isWork && !cls ? "work" : cls || type === "homework" ? "school" : "personal";

  // ── Notes: everything after "it needs…", "make sure…", a new sentence… ──
  // (Dates and classes were already found anywhere in the message.)
  let notes: string | null = null;
  const notesStart = findNotesStart(low);
  if (notesStart >= 0) {
    notes = cleanNotes(original.slice(notesStart));
    spans.claim(notesStart, original.length);
  }

  // ── Title & category ─────────────────────────────────────────────────────
  let title = restoreCase(cleanTitle(spans.leftover(original), type), rawText);
  if (type === "workout") {
    // "ran 2 miles in 18 min" → "Run" (the miles and minutes are kept separately).
    const cardio: Record<string, string> = { ran: "Run", run: "Run", jogged: "Jog", jog: "Jog", biked: "Bike ride", bike: "Bike ride", swam: "Swim", swim: "Swim", hiked: "Hike", hike: "Hike", rowed: "Row" };
    title = title.replace(/^(ran|run|jogged|jog|biked|bike|swam|swim|hiked|hike|rowed)\b(?:\s+(?:in|for))?\s*$/i, (w: string, v: string) => cardio[v.toLowerCase()] ?? w);
  }
  let category: string | null = null;
  if (type === "expense") category = title ? title.toLowerCase() : null;
  if (!title) title = cls && type === "homework" ? DEFAULT_TITLES.homework : incoming ? "Paycheck" : DEFAULT_TITLES[type];
  title = title.replace(/\bi\b/g, "I");
  if (notes) notes = restoreCase(notes, rawText).replace(/\bi\b/g, "I");

  // ── What's missing? ──────────────────────────────────────────────────────
  if (type === "homework" && !when) {
    problems.push("No due date found");
    confidence -= 0.3;
  }
  if (type === "homework" && !cls) {
    problems.push(classProblem ?? "No class matched");
    confidence -= 0.2;
  }
  if (type === "food" && calories === null) {
    problems.push("Calories needed");
    confidence -= 0.3;
  }
  if (type === "expense" && amount === null) {
    problems.push("No amount found");
    confidence -= 0.4;
  }
  if (type === "workout" && !sets && distanceMiles === null && minutes === null) {
    problems.push("No sets, distance or time found");
    confidence -= 0.2;
  }

  return {
    type,
    title,
    rawText,
    when,
    classId: cls?.id ?? null,
    className: cls?.name ?? null,
    amount,
    quantity,
    minutes,
    sets,
    distanceMiles,
    category,
    habitName,
    calories,
    proteinG,
    mood: null,
    repeat,
    incoming,
    notes,
    area,
    confidence: clamp01(confidence),
    problems,
  };
}

function emptyDraft(type: CaptureType, rawText: string): CaptureDraft {
  return {
    type, title: "", rawText, when: null, classId: null, className: null, amount: null, quantity: null,
    minutes: null, sets: null, distanceMiles: null, category: null, habitName: null, calories: null, proteinG: null,
    mood: null, repeat: null, incoming: false,
    notes: null, area: "personal", confidence: 1, problems: [],
  };
}

/** Mood from words in a journal line ("today was great" → 5). The lowest mood word wins; null if none. */
export function moodOf(low: string): number | null {
  if (/\b(not|wasn'?t|isn'?t|didn'?t feel)\s+(?:very\s+|that\s+|so\s+)?(good|great|happy|productive)\b/.test(low)) return 2;
  const scores = MOOD_WORDS.filter(([re]) => re.test(low)).map(([, score]) => score);
  return scores.length ? Math.min(...scores) : null;
}

/**
 * Speech tidying lowercases everything. Put back capitals that were actually
 * said (names like "Johnson" or "Smith"), except the first word.
 */
function restoreCase(title: string, rawText: string): string {
  const caps = new Map<string, string>();
  const words = rawText.match(/[A-Za-z][A-Za-z']*/g) ?? [];
  for (const w of words.slice(1)) if (/^[A-Z]/.test(w) && w !== "I") caps.set(w.toLowerCase(), w);
  if (!caps.size) return title;
  return title.replace(/[A-Za-z][A-Za-z']*/g, (w: string, offset: number) => (offset === 0 ? w : (caps.get(w.toLowerCase()) ?? w)));
}
