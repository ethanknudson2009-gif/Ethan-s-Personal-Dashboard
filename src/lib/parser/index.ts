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
  /\b(shift|my boss|manager|coworkers?|clock (?:in|out)|timesheet|prmi|at work|for work|from work|to work|the office|mike|my lo|loan officer|loan files?|borrowers?|closing|underwriting)\b|^(?:work|primary)\b/;

// ── Notes: where the main thing ends and extra context begins ─────────────
const NOTE_MARKERS =
  /(?:[,.;:!?]\s*|\s)(?=(?:notes?\s*:|note that|it needs|it has to|it should|it'?s about|it is about|make sure|remember|don'?t forget|because|so that|(?:the )?teacher said|(?:she|he|they) said|also|and also|bring|include|including|details?\s*:)\b)/g;

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
const EXPENSE_VERBS = /\b(spent|spend|paid|pay|bought|buy|cost|costs)\b/;
/** Money coming in (saved to Money as income). */
const INCOME_WORDS = /\b(got paid|get paid|paid me|paycheck|payday|got \$?\d|received \$?\d|earned|refund(?:ed)?)\b/;
const FOOD_WORDS = /\b(ate|eat|eating|drank|drink|breakfast|lunch|dinner|snack|calories|cals?|kcal)\b/;
const WORKOUT_WORDS =
  /\b(gym|workout|worked out|lift|lifted|bench|squat|squats|deadlift|deadlifts|ran|run|jog|jogged|miles?|sets?|reps?|push-?ups?|pull-?ups?|curls?|cardio|swim|swam|bike|biked)\b|\b\d+\s*x\s*\d+\b/;
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
  expense: /^(spent|spend|paid|pay|bought|buy)\b/,
  workout: /^(did|went|worked out)\b/,
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

  // 3) A word that is the start of a word in a class name: "anat" → "Human Anatomy".
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

function detectType(low: string, ctx: ParseContext, isNote: boolean): CaptureType | null {
  if (isNote) return "note";
  // Money in or out ("got paid $400" is income; "spent $12" is spending).
  if ((INCOME_WORDS.test(low) || EXPENSE_VERBS.test(low)) && /\$\s?\d|\d\s*(?:dollars|bucks)\b/.test(low)) return "expense";
  if (EXPENSE_VERBS.test(low)) return "expense";
  if (FOOD_WORDS.test(low)) return "food";
  if (WORKOUT_WORDS.test(low)) return "workout";
  if ((ctx.habits ?? []).some((h) => new RegExp(`\\b${escapeRe(h.toLowerCase())}\\b`).test(low))) return "habit";
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
      title: original ? original.charAt(0).toUpperCase() + original.slice(1) : DEFAULT_TITLES.note,
      confidence: 1,
    };
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
    /\b(?:(?:about|around|takes?|for)\s+|~\s*)?(\d+(?:\.\d+)?|an?|half an?)\s*(hours?|hrs?|hr|h|minutes?|mins?|min)\b/g,
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
    habitName = (ctx.habits ?? []).find((h) => new RegExp(`\\b${escapeRe(h.toLowerCase())}\\b`).test(low)) ?? null;
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
  let title = cleanTitle(spans.leftover(original), type);
  let category: string | null = null;
  if (type === "expense") category = title ? title.toLowerCase() : null;
  if (!title) title = cls && type === "homework" ? DEFAULT_TITLES.homework : DEFAULT_TITLES[type];

  // ── What's missing? ──────────────────────────────────────────────────────
  if (type === "homework" && !when) {
    problems.push("No due date found");
    confidence -= 0.3;
  }
  if (type === "homework" && !cls) {
    problems.push(classProblem ?? "No class matched");
    confidence -= 0.2;
  }
  if (type === "food") {
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
    minutes: null, sets: null, distanceMiles: null, category: null, habitName: null, incoming: false,
    notes: null, area: "personal", confidence: 1, problems: [],
  };
}
