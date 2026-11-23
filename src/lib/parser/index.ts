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
import { notePoints, organizeNotes, stripLeadIn } from "./notes";
import { editDistance, normalizeSpoken, tolerance } from "./spoken";
import { EXERCISE_LIBRARY, plain } from "../exercise-library";

/**
 * Sports and cardio from the exercise library ("yoga", "pickleball",
 * "bouldering"). Words that are also everyday talk (walk, run, stairs,
 * stretching, dance…) are left out; those need gym words around them.
 */
const EVERYDAY = new Set(["walk", "walking", "run", "running", "bike", "stairs", "laps", "spin", "dance", "dancing", "stretching", "stretch session", "mobility", "skating", "ruck", "swim", "hike", "erg", "rowing", "cycling", "biking", "jog", "jogging", "sprint", "climbing", "football", "baseball", "golf"]);
const SPORT_NAMES = [...new Set(EXERCISE_LIBRARY.filter((e) => e.muscle === "cardio").flatMap((e) => [e.name, ...e.aliases]).map(plain))]
  .filter((w) => w.length > 2 && !EVERYDAY.has(w))
  .sort((a, b) => b.length - a.length);
const SPORT = new RegExp(`\\b(?:${SPORT_NAMES.join("|")})\\b`);
/** "did yoga", "played basketball for an hour", "went bouldering": something you did, to log. */
function sportDone(low: string): boolean {
  if (!SPORT.test(low)) return false;
  const did = /^(?:i\s+)?(?:just\s+)?(?:did|played|went|had|finished|got in|got done with)\b/.test(low);
  const forTime = /\bfor\s+(?:an?|\d+(?:\.\d+)?|half an?)\s*(?:min(?:ute)?s?|hours?|hrs?)\b/.test(low);
  const future = /\b(?:need to|have to|gotta|going to|gonna|tomorrow|tonight|next|later|sign up|practice at|at \d)\b/.test(low);
  return (did || forTime) && !future;
}

export type CaptureType = "homework" | "task" | "food" | "workout" | "expense" | "note" | "habit";

export type ClassRef = { id: string; name: string; shortNames?: string[] };

export type ParseContext = {
  now: Date;
  timeZone: string;
  /** True when the text came from speech-to-text: tidy fillers, spoken numbers and near-miss words first. */
  spoken?: boolean;
  /** The words exactly as the recognizer wrote them, so names it capitalized ("Johnson") keep their capitals. */
  caseSource?: string;
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
  /** "every Monday", "daily", "every other week", "monthly". */
  repeat: "daily" | "weekly" | "biweekly" | "monthly" | null;
  /** Money coming in ("got paid $400", "paycheck") rather than spent. */
  incoming: boolean;
  /** True when the day was only found in the details ("…he wants it before Thursday"). */
  whenFromNotes?: boolean;
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
const WORK_TAGS = /(?<!\b(?:go|going|get|drive|driving|head|leave|come|walk|ride|back)\s)\b(?:at|for|from|to) (?:work|prmi|primary|the office)\b|\bprmi\b|^(?:work(?!\s+(?:on|shift)\b)|primary|the office)\b:?/g;
/** Words that suggest work but stay in the title ("send Mike the files"). */
const WORK_HINTS =
  /\b(shift|my boss|manager|coworkers?|clock (?:in|out)|timesheet|prmi|at work|for work|from work|to work|the office|mike|my lo|loan officer|loans?|loan files?|borrowers?|closing|closings|underwriting|underwriter|appraisals?|disclosures?|escrow|title company|pre-?approvals?|preapproval letter|rate locks?|lock the rate|refi|refinance|conditions|voe|1003|loan estimate|closing disclosure|processor|realtors?|pipeline|encompass|credit pull|pull credit|pay ?stubs?|w-?2s?|bank statements?|le|cd|coc|ctc|clear to close|du|lp|aus|vod|voe|loe|lox|letters? of explanation|gift letters?|condo questionnaires?|hoa certs?|title commitments?|commitment letters?|tri-?merge|dti|ltv|pmi|piti|trid|rate lock|lock extension|new leads?|the leads?|hr|the [a-z]+ (?:file|loan|refi|purchase))\b|^(?:work(?!\s+on\b)|primary)\b/;

// ── Notes: where the main thing ends and extra context begins ─────────────
const NOTE_MARKERS =
  /(?<!\b(?:if|whether|that|because|cause|since|when|said|says|think|know|asked?|until|unless|get|got|getting|have|had|has))(?<!\b(?:tell|told|let|ask|remind|text|email|show|warn)\s+[a-z]+)(?:[,.;:!?]\s*|\s)(?=(?:notes?\s*:|i still (?:need|have) to|i think|i guess|i feel like|(?:the|my|his|her|their|our) (?:[a-z]+ )?(?!(?:it|they|he|she|we|i|you)\b)[a-z]+ (?:is|are|was|were|keeps|has been|have been|has(?! to)|have(?! to)|changed|came|went|broke|got|moved|died|fell|ran out|expires|expired|ends|closes|starts)|i (?:forgot|left|lost) (?:it|them|my|the)|or (?:else )?(?:they'?ll|it'?ll|i'?ll|you'?ll|i get|i'?m gonna|they|it)|we'?re|we are|they'?re|i haven'?t|i didn'?t|i still haven'?t|i'?m (?:so|really|kinda|super) |note that|it needs|it has to|it should|it must|it'?s about|it is about|make sure|be sure|remember|don'?t forget|dont forget|because|cause|so that|so i can|so we can|so i|so we|(?:the |my )?teacher said|(?:she|he|they|mike) said|(?:she|he|they|mike) wants?|(?:she|he|they|mike) needs?|also|and also|plus|another thing|one more thing|oh and|bring|include|including|it covers|it'?s on|it is on|it'?s worth|it is worth|it'?s for|it is for|it'?ll be|it will be|it'?s going to be|it'?s gonna be|it'?s like|it'?s only|it'?s just|it'?s a|it is a|it'?s an|it'?s the|it'?s due|it is due|it'?s at|it is at|it'?s|it is|it was|that'?s|which is|which|i need to|i have to|i should|i gotta|i'?ve got to|i want to|we need to|we have to|i'?ll|i will|i have (?:some|a|an|the|my|these|those)|(?:it|she|he|they) (?:came|went|got|is|isn'?t|was|wasn'?t|has|hasn'?t|had|did|didn'?t|does|doesn'?t|can'?t|won'?t|already)|and ask|ask (?:him|her|them|mike|about)|and tell|tell (?:him|her|them|mike)|details?\s*:)\b)/g;

/** Where notes start in the text, or -1. The main part keeps at least 2 words. */
export function findNotesStart(low: string, after = 0): number {
  const enoughBefore = (i: number) => i > after && low.slice(0, i).trim().split(/\s+/).filter(Boolean).length >= 1;
  const candidates: number[] = [];
  for (const m of low.matchAll(NOTE_MARKERS)) if (enoughBefore(m.index)) candidates.push(m.index);
  // A new sentence also starts notes: "Speech outline due Thursday. Three pages."
  for (const m of low.matchAll(/[.!?]\s+(?=\S)/g)) if (enoughBefore(m.index)) candidates.push(m.index);
  return candidates.length ? Math.min(...candidates) : -1;
}


// ── Keyword lists ───────────────────────────────────────────────────────────
const EXPENSE_VERBS = /\b(spent|spend|paid|pay|bought|buy|cost|costs|venmo'?d|venmoed|zelled|zelle'?d|cash ?app'?d|cash ?apped|sent)\b/;
/** Money already gone ("spent", "paid", "venmo'd"): spending even without a $ sign. Future "pay the bill" stays a task. */
const SPENT_VERBS = /\b(spent|paid|bought|cost|costs|venmo'?d|venmoed|zelled|zelle'?d|cash ?app'?d|cash ?apped)\b/;
/** Money coming in (saved to Money as income). */
const INCOME_WORDS = /\b(got paid|get paid|paid me|paycheck|payday|got \$?\d|received \$?\d|earned|refund(?:ed)?|direct deposit|venmo'?d me|sent me)\b/;
const FOOD_WORDS = /\b(ate|eat|eating|drank|drink|breakfast|lunch|dinner|snack|calories|cals?|kcal|protein)\b/;
const WORKOUT_WORDS =
  /\b(gym|workout|worked out|lift|lifted|bench|benched|squat|squats|squatted|deadlift|deadlifts|deadlifted|repped|pr'?d|hit (?:legs|chest|back|arms|shoulders|push|pull|the gym)|pulled \d{2,3}|\d+ plates?|ran|run|jog|jogged|miles?|sets?|reps?|push-?ups?|pull-?ups?|curls?|cardio|swim|swam|bike|biked|hiked?|hiking|rowed|elliptical|treadmill|stairmaster|leg day|arm day|chest day|back day|push day|pull day)\b|\b\d+\s*x\s*\d+\b/;
/** Starts that make it a to-do even when food or gym words come later. */
const TASK_VERB_START =
  /^(?:pick up|drop off|call|text|email|e-mail|message|buy|grab|order|cook|meal prep|prep|schedule|book|go to|meet|send|pay|finish|study|clean|wash|take out|bring|plan|make|get|return|cancel|sign up|register|reply|respond|print|submit|turn in|fill out|look up|set up|ask|tell|remind)\b/;
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
  "~", "@", "and", "&", "of", "a", "an", "in", "my", "before", "until", "till",
]);
/** Everyday words that also start a class name ("his" → History): never a class guess. */
const NOT_A_CLASS_START = new Set(["his", "her", "part", "page", "test", "work", "home", "back", "read", "real", "more", "form", "life", "line", "list", "last", "late", "lead", "high", "even", "some", "come", "spent", "college"]);
/** Verbs dropped from the start of the title for these types ("ate eggs" → "Eggs"). */
const LEAD_VERBS: Partial<Record<CaptureType, RegExp>> = {
  food: /^(ate|eat|eating|drank|drink|had|grabbed|grab|got)\b/,
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
      // "practice my speech in front of…": the class word IS the thing, so it stays in the title.
      // "speech outline", "for speech", "in anatomy", "my algebra homework": it just says the class, so it's removed.
      const partOfThing =
        /\b(?:my|the|this|your|our)\s+$/.test(low.slice(0, m.index)) &&
        /^(?:\s*$|\s*[,.;!?]|\s+(?:in|on|at|for|to|with|before|after|by|and|so|until|because|tonight|tomorrow|today|again|twice|once)\b)/.test(low.slice(m.index + m[0].length));
      // "switching out of choir", "drop choir": the class is what it's about.
      const isObject = /\b(?:out of|into|join|joining|drop|dropping|quit|quitting|switch|switching)\s+$/.test(low.slice(0, m.index));
      if (!partOfThing && !isObject) {
        // "read chapter 9 for anatomy and do the vocab": "for" goes with the class.
        const prep = /\b(?:for|in)\s+(?:my\s+)?$/.exec(low.slice(0, m.index));
        const ends = /^(?:\s*$|\s*[,.;!?]|\s+(?:and|by|on|due|tonight|tomorrow|today|this|next|before)\b)/.test(low.slice(m.index + m[0].length));
        const start = prep && ends ? prep.index : m.index;
        spans.claim(start, m.index + m[0].length);
      }
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
    if (FILLER.has(word) || NOT_A_CLASS_START.has(word)) continue;
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

function detectType(low: string, ctx: ParseContext): CaptureType | null {
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
  // "pick up mom and grab lunch", "go to the gym at 6": a plan, so a task.
  const plan = TASK_VERB_START.test(low) && !/\d+\s*x\s*\d+|\bsets?\s+of\b/.test(low);
  // "lunch with mom on sunday", "coffee with Jake": plans, not food you ate.
  const mealPlan = /\b(?:breakfast|brunch|lunch|dinner|coffee)\s+(?:with|at)\b|\b(?:during|at|before|after|over|by) (?:breakfast|brunch|lunch|dinner)\b|\b(?:meet|meeting|go over|talk to)\b/.test(low) && !/\b(?:ate|had|calories|cals?|kcal|protein)\b/.test(low);
  // "costco run", "run DU", "run credit": errands and work, not exercise.
  const notExercise =
    /\b(?:costco|grocery|groceries|target|walmart|food|store|coffee|starbucks|supply|errand|bank|dump|taco|mcdonald'?s|gas) run\b|\b(?:run|ran)\s+(?:du|lp|aus|credit|numbers|the numbers|errands?|a report|the report|the file|the loan|scenarios?|a scenario|it by)\b/.test(low) ||
    (WORK_HINTS.test(low) && !/\d+\s*x\s*\d+|\bsets?\b|\breps?\b|\bplates?\b|\bgym\b/.test(low));
  if (!plan && !mealPlan && FOOD_WORDS.test(low)) return "food";
  // "gym after school", "chest day tomorrow": a plan to go, not a workout to log.
  const gymPlan = /\b(?:gym|workout|leg day|arm day|chest day|back day|push day|pull day)\b/.test(low) && !/\d|\b(?:did|went|worked out|lifted|hit|benched|squatted|ran|finished|done)\b/.test(low) && /\b(?:after|before|later|tonight|tomorrow|today|this|next|at|around|go|going|gonna|need|have to|want)\b/.test(low);
  if (!plan && !notExercise && !gymPlan && (WORKOUT_WORDS.test(low) || sportDone(low))) return "workout";
  if (/\$\s?\d/.test(low)) return "expense";
  if (SCHOOL_WORDS.test(low) && !/^(?:call|text|email|e-mail|message|ask|tell|meet|remind)\b/.test(low)) return "homework";
  return null; // decided later (a class match makes it homework, otherwise task)
}

function cleanTitle(leftover: string, type: CaptureType): string {
  let words = leftover
    .replace(/[;!?]+/g, " ")
    .replace(/\s*,\s*/g, " , ")
    .split(/\s+/)
    .map((w) => (w === "," ? w : w.replace(/^[^\w$#'"]+|[^\w'"]+$/g, "")))
    .filter((w) => w.length > 0);
  const lead = LEAD_VERBS[type];
  while (words.length > 0 && lead && lead.test(words.slice(0, 2).join(" ").toLowerCase())) {
    const m = words.slice(0, 2).join(" ").toLowerCase().match(lead)!;
    words = words.slice(m[0].split(" ").length);
  }
  // Drop filler words at the start and end, and "due"/"by" anywhere.
  words = words.filter((w) => !["due", "by"].includes(w.toLowerCase()));
  const edgeJunk = (w: string) => FILLER.has(w.toLowerCase()) || w === ",";
  while (words.length && edgeJunk(words[0])) words.shift();
  const particle = (i: number) =>
    words[i]?.toLowerCase() === "in" && /^(?:came|come|comes|coming|turn|turned|it|them|check|checked|log|logged|sign|signed|hand|handed|fill|plug|clock|clocked|move|moved|log)$/i.test(words[i - 1] ?? "");
  while (words.length && (edgeJunk(words[words.length - 1]) || /^(?:like|um|uh)$/i.test(words[words.length - 1])) && !particle(words.length - 1)) words.pop();
  // Only commas between two real words stay; "milk , , eggs" → "milk, eggs".
  words = words.filter((w, i) => w !== "," || (words[i - 1] !== "," && i > 0));
  // Speech arrives lowercase: give names we know their capitals back.
  const title = words.join(" ").replace(/ ,/g, ",").replace(PROPER_NAMES, (w) => PROPER[w.toLowerCase()] ?? w);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** People and places Ethan mentions (Mike is his loan officer at PRMI). */
const PROPER: Record<string, string> = {
  mike: "Mike", prmi: "PRMI", lo: "LO", hr: "HR",
  le: "LE", cd: "CD", coc: "COC", ctc: "CTC", du: "DU", lp: "LP", aus: "AUS", voe: "VOE", vod: "VOD", loe: "LOE", lox: "LOX",
  hoa: "HOA", dti: "DTI", ltv: "LTV", pmi: "PMI", piti: "PITI", trid: "TRID", pr: "PR",
  facetime: "FaceTime", venmo: "Venmo", zelle: "Zelle", costco: "Costco", walgreens: "Walgreens", chipotle: "Chipotle", encompass: "Encompass",
};
const PROPER_NAMES = new RegExp(`\\b(${Object.keys(PROPER).join("|")})\\b`, "gi");

const DEFAULT_TITLES: Record<CaptureType, string> = {
  homework: "Homework", task: "Task", food: "Food", workout: "Workout",
  expense: "Expense", note: "Note", habit: "Habit",
};

/** Words a long title can be cut before ("Essay on the Civil War | about the causes…"). */
// Best spots first: "…using three quotes", "…that he sent", then "and", then "about/for/to".
const TITLE_CUTS: { words: string[]; latest: boolean }[] = [
  { words: [","], latest: true },
  { words: ["using", "with", "that", "which", "because", "so", "since", "where", "when", "but", "while", "before", "after", "once", "until"], latest: true },
  { words: ["and"], latest: true },
  { words: ["about", "for", "to", "on"], latest: false },
];
const MAX_TITLE_WORDS = 12;
/** With no natural spot to cut, a title this long is still kept whole. */
const HARD_MAX_TITLE_WORDS = 18;

/** Split a run-on title into a short title and the rest (or null if it's short enough). */
export function cutLongTitle(title: string): { title: string; rest: string } | null {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_TITLE_WORDS) return null;
  for (const { words: cuts, latest } of TITLE_CUTS) {
    const spots: number[] = [];
    // Cut after word 3 at the earliest, and leave at least 2 words for the notes.
    for (let i = 3; i <= MAX_TITLE_WORDS && i < words.length - 1; i++) {
      // A comma cut goes after the word with the comma.
      if (cuts[0] === "," ? words[i - 1].endsWith(",") : cuts.includes(words[i].toLowerCase())) spots.push(i);
    }
    if (spots.length) {
      const i = latest ? spots[spots.length - 1] : spots[0];
      return { title: words.slice(0, i).join(" ").replace(/,$/, ""), rest: words.slice(i).join(" ") };
    }
  }
  // No natural spot: cutting mid-phrase ("…those initial | disclosures signed off") reads worse than a long title.
  if (words.length <= HARD_MAX_TITLE_WORDS) return null;
  return { title: words.slice(0, 12).join(" ").replace(/,$/, ""), rest: words.slice(12).join(" ") };
}

/** Titles that say nothing ("Do homework", "Stuff"): the first detail is the real thing. */
const GENERIC_TITLE = /^(?:(?:do|finish|work on|start|get|my|some|the|for)\s+)*(?:homework|hw|assignments?|work|stuff|things?|school ?work|task|class)$/i;

/** A title that only says when/where ("After school"): the thing itself came after. */
const CONTEXT_ONLY_TITLE =
  /^(?:in the (?:morning|afternoon|evening)|this (?:morning|afternoon|evening)|after (?:school|work|class|lunch|practice)|before (?:school|work|class)|at (?:lunch|work|school)|on my (?:lunch|break)|later(?: on| today)?|first thing(?: in the morning)?)$/i;

/** A note that only repeats the due day ("Due Thursday", "It's due tomorrow at 5"). */
const ONLY_A_DAY =
  /^(?:it'?s |it is |and )?(?:due )?(?:on |by |before )?(?:the )?(?:today|tonight|tomorrow|this weekend|next week|(?:next |this )?(?:mon|tues|wednes|thurs|fri|satur|sun)day|\d{1,2}(?:st|nd|rd|th))(?: (?:at|by) \d{1,2}(?::\d{2})?\s*(?:am|pm)?| (?:morning|afternoon|night|evening))?$/i;

/** Details that are really the thing to do: "(for history) I have some textbook questions", "I need to memorize…". */
const DOING_START =
  /^[\s,.;:!?]*(?:(?:and|so|also|then|okay|ok|um|uh)\s+)*(?:for (?:my |the )?[a-z' ]{2,30}?\s+)?(?:i (?:also )?(?:need|have|gotta|got|should|want|must) to|i'?ve got to|i gotta|we (?:need|have) to|i have (?:some|a|an|the|my|these|those)|i'?ve got (?:some|a|an|the|my)|there'?s (?:a|an|some|the))\b/i;

/** "I have some textbook questions (that) I need to get done" → "…textbook questions". */
const GET_DONE =
  /(?<=[a-z0-9'])(?<!\b(?:yesterday|today|tonight|tomorrow|week|day|monday|tuesday|wednesday|thursday|friday|saturday|sunday))[\s,]+(?:that |which )?(?:i|we) (?:need|have|got|gotta|'?ve got|still need|still have) to (?:get (?:it |them |that )?(?:done|finished|in)|finish(?: it| them| up)?|do(?: it| them)?|turn (?:it |them )?in|complete)\b(?=\s*(?:[.,;!?]|$|and\b|i\b|it\b|for\b|by\b|before\b|on\b|tomorrow\b|today\b|tonight\b))/gi;

/** Days said about the past ("the lab I missed on Tuesday") aren't due dates. */
const PAST_DAY =
  /\b(?:missed|was|were|had|did|didn'?t|wasn'?t|went|happened|got|took|from|since|last|ago)\s+(?:[a-z']+\s+){0,4}?(?:on\s+)?(?:last\s+)?((?:mon|tues|tue|wednes|wed|thurs|thu|fri|satur|sat|sun)(?:day)?|yesterday)\b/g;
const maskPastDays = (low: string) =>
  low.replace(PAST_DAY, (m, day: string) =>
    /\b(?:next|this|coming|to|by|before|until|till)\s+$/.test(m.slice(0, m.length - day.length)) ? m : m.slice(0, m.length - day.length) + " ".repeat(day.length),
  );

export function parse(rawText: string, ctx: ParseContext, opts: { depth?: number } = {}): CaptureDraft {
  const { draft, notesRaw } = parseOnce(rawText, ctx);
  if ((opts.depth ?? 0) > 1 || (draft.type !== "task" && draft.type !== "homework")) return draft;

  // The main part was only "for speech" / "do homework" and the real thing came after
  // ("so for speech I need to memorize the first half…"): use that detail as the title.
  if (draft.notes && draft.when) {
    const kept = notePoints(draft.notes).filter((p) => !ONLY_A_DAY.test(p));
    draft.notes = kept.length ? (kept.length === 1 ? kept[0] : kept.map((p) => `• ${p}`).join("\n")) : null;
  }
  const empty = draft.title === DEFAULT_TITLES[draft.type] || GENERIC_TITLE.test(draft.title) || CONTEXT_ONLY_TITLE.test(draft.title);
  if (empty && draft.notes && notesRaw && (DOING_START.test(notesRaw) || CONTEXT_ONLY_TITLE.test(draft.title))) {
    const points = notePoints(draft.notes);
    // "For world history" + "I have some textbook questions" were said as one thought.
    const take = points.length > 1 && points[0].split(" ").length <= 4 && /^for\b/i.test(points[0]) ? 2 : 1;
    const first = points.slice(0, take).join(" ");
    const rest = points.slice(take);
    const innerCtx = { ...ctx, spoken: false, caseSource: ctx.caseSource ?? rawText, classes: draft.classId ? [] : ctx.classes };
    const inner = parse(first, innerCtx, { depth: (opts.depth ?? 0) + 1 });
    if (inner.title && inner.title !== DEFAULT_TITLES[inner.type] && !GENERIC_TITLE.test(inner.title)) {
      const notes = organizeNotes([inner.notes ?? "", ...rest].filter(Boolean).join("\n"));
      const when = draft.when ?? inner.when;
      const cls = draft.classId ? { id: draft.classId, name: draft.className } : { id: inner.classId, name: inner.className };
      return {
        ...draft,
        type: cls.id ? "homework" : draft.type,
        title: inner.title,
        notes,
        when,
        whenFromNotes: draft.when ? draft.whenFromNotes : Boolean(inner.when),
        classId: cls.id,
        className: cls.name,
        area: cls.id ? "school" : draft.area === "personal" ? inner.area : draft.area,
        problems: draft.problems.filter((p) => !(when && p === "No due date found") && !(cls.id && /class/i.test(p))),
      };
    }
  }
  return draft;
}

function parseOnce(rawText: string, ctx: ParseContext): { draft: CaptureDraft; notesRaw: string | null } {
  const result = parseInner(rawText, ctx);
  return result;
}

function parseInner(rawText: string, ctx: ParseContext): { draft: CaptureDraft; notesRaw: string | null } {
  // Same length for both, so match positions line up for building the title.
  let original = (ctx.spoken ? normalizeSpoken(rawText) : rawText).trim().replace(/\s+/g, " ");
  // "…textbook questions I need to get done" → "…textbook questions".
  original = original.replace(GET_DONE, "");
  // "…essay that was due yesterday" says why it's late, not when it's due.
  original = original.replace(/\s+(?:that|which) (?:was|were) (?:due|assigned) (?:[a-z]+ ){0,2}?(?:yesterday|last [a-z]+|on (?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/gi, "");
  // "Okay so I need to…", "remind me to…": warm-up words aren't the thing.
  // ("At work I need to…" still says it's for work.)
  // "we got clear to close on the Wilson loan tell Mike" → "Tell Mike we got clear to close…"
  original = original.replace(/^(?!(?:tell|text|email|let|call|ask)\b)(.{8,}?)[,.]?\s+(tell|text|email|call) (mike|him|her|them|mom|dad|[a-z]+)$/i, "$2 $3 $1");
  original = original.replace(/^(?!(?:tell|text|email|let|call|ask)\b)(.{8,}?)[,.]?\s+let (mike|him|her|them|mom|dad|[a-z]+) know$/i, "let $2 know $1");
  // Talking like a person: "the plan for today is gym" → "today gym",
  // "I'm going to the gym later" → "go to the gym later", "…I think" at the end is just a hedge.
  original = original
    .replace(/\bthe plan (?:for )?(today|tomorrow|tonight|this weekend)(?: is)?\b/i, "$1")
    .replace(/\bi(?:'m| am) (?:going|gonna go|heading) to (?=the |my |work\b|school\b|class\b|practice\b|[a-z]+'s\b|costco|target|walmart)/i, "go to ")
    .replace(/\b(?:i (?:have|need|gotta|got) to|i'?ve got to|i gotta) work\b(?!\s+on\b)/i, "work shift")
    // (speech cleanup may already have dropped "I have to": "work saturday from 9 to 1")
    .replace(/^work(?=\s+(?:(?:on\s+)?(?:mon|tues|wednes|thurs|fri|satur|sun)day|today|tonight|tomorrow)(?:\s+(?:from|at|until|till)\s+\d.*)?\s*$)/i, "work shift")
    .replace(/\s+(?:i think|i guess|i believe|or something|or whatever|or so)\s*[.!?]?\s*$/i, "")
    .replace(/\blater\s+(?=(?:around|at|by)\s+\d)/i, "");
  const saidWork = WORK_HINTS.test(original.toLowerCase().slice(0, 40));
  const saidWorkFirst = /^(?:\W*(?:okay|ok|so|then|and|alright|um|uh)\b[\s,]*)*(?:at|for) (?:work|the office|prmi|primary)\b/i.test(original);
  original = stripLeadIn(original);
  // "add milk to my list" → "milk" (the list is the app itself).
  original = original.replace(/^(?:add\s+)?(.+?)\s+(?:to|on|onto) (?:my|the) (?:list|to-?do list|todo list|to-?dos|tasks|reminders)\b/i, "$1");
  const caseText = ctx.caseSource ? `${rawText}\n${ctx.caseSource}` : rawText;
  const low = original.toLowerCase();

  const spans = new SpanTracker();
  const problems: string[] = [];
  let confidence = 1;

  // What kind of thing it is comes from the main part, not the details
  // ("pick up mom at 5, grab lunch on the way" is a task, not food).
  const notesStart = findNotesStart(low);
  const head = notesStart > 0 ? low.slice(0, notesStart) : low;
  const type0 = detectType(head, ctx);


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
  // The day said in the main part wins ("math test next monday, so start studying on the weekend").
  let dateResult = parseWhen(maskPastDays(head), spans, ctx.now, ctx.timeZone);
  let whenFromNotes = false;
  if (!dateResult.when && head.length < low.length) {
    dateResult = parseWhen(maskPastDays(low), spans, ctx.now, ctx.timeZone);
    whenFromNotes = Boolean(dateResult.when);
  }
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
  const isWork = saidWorkFirst || saidWork || WORK_HINTS.test(low) || /\bprmi\b/.test(low);
  if (isWork) {
    // "at work" / "for PRMI" just say where it belongs: keep them out of the title.
    for (const m of spans.free(WORK_TAGS, low)) spans.claim(m.index, m.index + m[0].length);
  }
  const area: Area = isWork && !cls ? "work" : cls || type === "homework" ? "school" : "personal";

  // ── Notes: everything after "it needs…", "make sure…", a new sentence… ──
  // (Dates and classes were already found anywhere in the message.)
  let notes: string | null = null;
  if (notesStart >= 0) {
    notes = organizeNotes(original.slice(notesStart));
    spans.claim(notesStart, original.length);
  }

  // ── Title & category ─────────────────────────────────────────────────────
  let title = restoreCase(cleanTitle(spans.leftover(original), type), caseText);
  if (type === "workout") {
    // "ran 2 miles in 18 min" → "Run" (the miles and minutes are kept separately).
    const cardio: Record<string, string> = { ran: "Run", run: "Run", jogged: "Jog", jog: "Jog", biked: "Bike ride", bike: "Bike ride", swam: "Swim", swim: "Swim", hiked: "Hike", hike: "Hike", rowed: "Row" };
    title = title.replace(/^(ran|run|jogged|jog|biked|bike|swam|swim|hiked|hike|rowed)\b(?:\s+(?:in|for))?\s*$/i, (w: string, v: string) => cardio[v.toLowerCase()] ?? w);
  }
  let category: string | null = null;
  if (type === "expense") category = title ? title.toLowerCase() : null;
  if (!title) title = cls && type === "homework" ? DEFAULT_TITLES.homework : incoming ? "Paycheck" : DEFAULT_TITLES[type];
  title = title.replace(/\bi\b/g, "I");
  // A class or day said first can leave warm-up words at the front ("for speech I need to memorize…").
  if (type === "homework" || type === "task") {
    const bare = stripLeadIn(title);
    if (bare !== title && bare.length > 0) title = bare.charAt(0).toUpperCase() + bare.slice(1);
  }
  // A title is a few words. A long run-on gets cut at a natural spot; the rest becomes notes.
  if (type === "homework" || type === "task") {
    const cut = cutLongTitle(title);
    if (cut) {
      title = cut.title;
      notes = organizeNotes([cut.rest, notes ? notes.replace(/^• /gm, "") : ""].filter(Boolean).join("\n"));
    }
  }
  if (notes) notes = restoreCase(notes, caseText).replace(/\bi\b/g, "I");

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

  return { notesRaw: notesStart >= 0 ? original.slice(notesStart) : null, draft: {
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
    repeat,
    incoming,
    whenFromNotes,
    notes,
    area,
    confidence: clamp01(confidence),
    problems,
  } };
}

/**
 * Speech tidying lowercases everything. Put back capitals that were actually
 * said (names like "Johnson" or "Smith"), except the first word.
 */
function restoreCase(title: string, rawText: string): string {
  const caps = new Map<string, string>();
  for (const m of rawText.matchAll(/[A-Za-z][A-Za-z']*/g)) {
    const w = m[0];
    // Capitals at the start of a sentence don't make a name.
    if (!/^[A-Z]/.test(w) || w === "I" || /^I'/.test(w) || /(?:^|[.!?:;\n]\s*)$/.test(rawText.slice(0, m.index))) continue;
    caps.set(w.toLowerCase(), w);
  }
  if (!caps.size) return title;
  return title.replace(/[A-Za-z][A-Za-z']*/g, (w: string, offset: number) => (offset === 0 ? w : (caps.get(w.toLowerCase()) ?? w)));
}
