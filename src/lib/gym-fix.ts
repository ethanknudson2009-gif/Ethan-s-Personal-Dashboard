/**
 * Fixing a past workout by voice:
 *   "on my last back day I actually hit dumbbell row for 12 reps not 10"
 *   "yesterday's bench was 145 not 135"
 *   "change my last set of squats to 8 reps"
 * readFix() pulls out what to change; the Gym actions find the workout and
 * show a preview ("Dumbbell row · Thu Nov 20 · set 2: 10 → 12 reps") that you
 * confirm before anything is saved.
 */
import { gymNumbers, readWorkout, type GymExercise } from "./gym-speech";

export type FixDay = { kind: "split"; word: string } | { kind: "daysAgo"; n: number } | { kind: "weekday"; day: number } | null;
export type GymFix = {
  exerciseId: string;
  exercise: string;
  /** null: work it out from the old number. "sets": how many sets (not fixable by voice yet). */
  field: "reps" | "weightLb" | "sets" | null;
  to: number;
  from: number | null;
  day: FixDay;
  /** 0-based set number, "last", "all", or null (whichever sets match). */
  set: number | "last" | "all" | null;
};

const SAYS_FIX =
  /\b(?:actually|not|instead of|wrong|fix|change|changed|correct|correction|meant|should (?:have been|be)|update|it was|that was)\b/;
const PAST =
  /\b(?:last|yesterday|earlier|today|this morning|on (?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:mon|tues|wednes|thurs|fri|satur|sun)day'?s?|my last|that|was|did|hit|got)\b/;
/** Everything in a fix that isn't the exercise's name. */
const FIX_TALK =
  /\b(?:yesterday|today|tonight|earlier|this morning|last|my|on|at|in|actually|not|instead|of|rather|than|fix|fixed|change|changed|correct|correction|meant|should|have|has|been|be|was|were|is|it|that|those|the|a|from|to|for|and|but|reps?|lbs?|pounds?|plates?|sets?|first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|did|do|hit|got|i|i'?m|update|number|all|every|each|them|(?:(?:chest|back|legs?|shoulders?|arms?|push|pull|upper|lower|full)(?: body)?(?: and [a-z]+)? )?day|(?:mon|tues|wednes|thurs|fri|satur|sun)day)(?:'?s)?\b/g;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ORDINAL: Record<string, number> = { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, fourth: 3, "4th": 3, fifth: 4, "5th": 4 };
const UNIT = String.raw`(reps?|lbs?|pounds?|plates?)?`;

const fieldOf = (unit: string | undefined): GymFix["field"] =>
  !unit ? null : /^rep/.test(unit) ? "reps" : "weightLb";

export function readFix(said: string, exercises: GymExercise[]): GymFix | null {
  const raw = gymNumbers(said.toLowerCase()).replace(/[,.!?]/g, " ").replace(/\s+/g, " ").trim();
  // "fix / change / correct …" is enough; otherwise it needs a past-tense clue too.
  if (!/\b(?:fix|change|correct|update)\b/.test(raw) && (!SAYS_FIX.test(raw) || !PAST.test(raw))) return null;
  // A plain "actually" isn't enough ("actually did bench 3x10 today" is a new log):
  // it needs a "not / instead of / from…to" or a past day to point at.
  const correcting = /\b(?:not|instead of|rather than|from \d+(?:\.\d+)? ?[a-z]* to|fix|change|changed|correct|correction|update|meant|should (?:have been|be)|wrong)\b/.test(raw);
  const pastDay = /\b(?:last|yesterday|(?:mon|tues|wednes|thurs|fri|satur|sun)day|(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th) set|set \d)\b/.test(raw);
  if (!correcting && !pastDay) return null;
  if (/\b\d+ ?x ?\d+\b|\bsets? of \d/.test(raw) && !correcting) return null;
  // "was actually 10" → "was 10" (words that don't change the numbers).
  const low = raw.replace(/\b(?:actually|really|honestly|like|just|totally)\s+/g, "");

  // The numbers: "12 reps not 10", "145 instead of 135", "from 10 to 12", "to 8 reps".
  let to: number | null = null;
  let from: number | null = null;
  let field: GymFix["field"] = null;
  const pairs: [RegExp, (m: RegExpExecArray) => void][] = [
    [new RegExp(String.raw`\b(\d+(?:\.\d+)?) ?${UNIT} (?:and |but )?(?:not|instead of|rather than) (?:the )?(\d+(?:\.\d+)?) ?${UNIT}`), (m) => {
      to = +m[1]; from = +m[3]; field = fieldOf(m[2] || m[4]);
    }],
    [new RegExp(String.raw`\bnot (\d+(?:\.\d+)?) ?${UNIT} (?:but |it was |i did |i hit )?(\d+(?:\.\d+)?) ?${UNIT}`), (m) => {
      from = +m[1]; to = +m[3]; field = fieldOf(m[2] || m[4]);
    }],
    [new RegExp(String.raw`\bfrom (\d+(?:\.\d+)?) ?${UNIT} to (\d+(?:\.\d+)?) ?${UNIT}`), (m) => {
      from = +m[1]; to = +m[3]; field = fieldOf(m[2] || m[4]);
    }],
    [new RegExp(String.raw`\b(?:to|was|were|be|been|for|did|hit|got) (\d+(?:\.\d+)?) ?${UNIT}`), (m) => {
      to = +m[1]; field = fieldOf(m[2]);
    }],
  ];
  for (const [re, take] of pairs) {
    const m = re.exec(low);
    if (m) {
      take(m);
      break;
    }
  }
  if (to === null) return null;
  // "4 sets not 3" changes how many sets there were, not a number in one set.
  // Marked so the preview can say "edit it by hand" instead of guessing.
  const setCount = /\b\d+ sets? (?:and |but )?(?:not|instead of|rather than)\b|\bnot \d+ sets?\b/.test(low);
  // Plates: "3 plates" means the bar weight.
  if (/plates?/.test(low) && field === "weightLb" && to !== null && (to as number) < 10) to = 45 + 90 * (to as number);

  // Which exercise: the gym reader already knows every name and nickname.
  // Only the exercise words go in: no numbers, days or "fix" talk ("yesterday's bench was…").
  const words = low
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(FIX_TALK, " ")
    .replace(/\s+/g, " ")
    .trim();
  const entry = readWorkout(words, exercises).entries.find((e) => e.exerciseId);
  if (!entry?.exerciseId) return null;

  // Which day.
  let day: FixDay = null;
  const split = /\b(?:last|my last|on (?:my )?last|on)\s+(chest|back|legs?|leg|shoulders?|arms?|push|pull|upper(?: body)?|lower(?: body)?|full body|bis|tris|back and biceps|shoulders and triceps)\s+day\b/.exec(low);
  if (split) day = { kind: "split", word: split[1].replace(/s$/, "") === "leg" ? "leg" : split[1] };
  else if (/\byesterday\b/.test(low)) day = { kind: "daysAgo", n: 1 };
  else if (/\b(?:today|this morning|earlier today)\b/.test(low)) day = { kind: "daysAgo", n: 0 };
  else {
    const wd = new RegExp(String.raw`\b(?:on |last )?(${WEEKDAYS.join("|")})(?:'?s)?\b`).exec(low);
    if (wd) day = { kind: "weekday", day: WEEKDAYS.indexOf(wd[1]) };
  }

  // Which set.
  let set: GymFix["set"] = null;
  const ord = /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th) set\b/.exec(low);
  const num = /\bset (?:number )?(\d)\b/.exec(low);
  if (ord) set = ORDINAL[ord[1]];
  else if (num) set = Math.max(0, +num[1] - 1);
  else if (/\blast set\b/.test(low)) set = "last";
  else if (/\b(?:all|every|each)(?: of the| of my| the)? sets?\b|\ball of them\b/.test(low)) set = "all";

  return { exerciseId: entry.exerciseId, exercise: entry.name, field: setCount ? "sets" : field, to, from, day, set };
}

export type FixSet = { id: string; weightLb: number | null; reps: number | null };
export type FixChange = { setId: string; n: number; field: "reps" | "weightLb"; before: number | null; after: number };

/** Which sets change, given the sets of that exercise in the chosen workout (in order). */
export function planFix(fix: GymFix, sets: FixSet[]): FixChange[] {
  if (!sets.length || fix.field === "sets") return [];
  let field = fix.field;
  if (!field) {
    // Work out reps vs weight from the old number, else from the size of the new one.
    if (fix.from !== null) {
      const r = sets.some((s) => s.reps === fix.from);
      const w = sets.some((s) => s.weightLb === fix.from);
      field = r && !w ? "reps" : w && !r ? "weightLb" : fix.to >= 30 ? "weightLb" : "reps";
    } else field = fix.to >= 30 && sets.some((s) => (s.weightLb ?? 0) > 0) ? "weightLb" : "reps";
  }
  const f = field;
  const val = (s: FixSet) => (f === "reps" ? s.reps : s.weightLb);
  const indexed = sets.map((s, n) => ({ s, n }));
  let pick: typeof indexed;
  if (typeof fix.set === "number") pick = indexed.filter((x) => x.n === fix.set);
  else if (fix.set === "last") pick = indexed.slice(-1);
  else if (fix.set === "all") pick = indexed;
  else if (fix.from !== null) pick = indexed.filter((x) => val(x.s) === fix.from);
  else pick = sets.every((s) => val(s) === val(sets[0])) ? indexed : indexed.slice(-1);
  return pick.filter((x) => val(x.s) !== fix.to).map((x) => ({ setId: x.s.id, n: x.n + 1, field: f, before: val(x.s), after: fix.to }));
}

/** "Set 2: 10 → 12 reps" */
export function changeLabel(c: FixChange): string {
  const unit = c.field === "reps" ? " reps" : " lb";
  return `Set ${c.n}: ${c.before ?? "–"} → ${c.after}${unit}`;
}
