/**
 * Cleans up what speech-to-text hears before the parser reads it, so you
 * can talk naturally, in any order:
 *
 *   "um can you add uh speech outline due thursday at three in the afternoon"
 *   → "speech outline due thursday at 3pm"
 *
 * - drops fillers and polite openers ("um", "remind me to", "can you add")
 * - turns spoken numbers into digits ("eleven fifty nine p m" → "11:59pm",
 *   "twenty dollars" → "20 dollars", "the fifth" → "the 5th")
 * - "in the morning/afternoon/evening", "tonight at 8" → am/pm
 * - snaps near-misses to words we know ("wensday" → "wednesday")
 */

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
};

/** Words we expect and want to snap misheard versions to. */
const KNOWN = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "august", "september", "october", "november", "december",
  "tomorrow", "tonight", "homework", "assignment", "worksheet", "project", "presentation", "midnight",
];

/** How many single-letter edits turn a into b (insert, delete, change, or swap two neighbors). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** How many mistakes we forgive for a word of this length. */
export function tolerance(length: number): number {
  return length >= 8 ? 2 : length >= 5 ? 1 : 0;
}

/** The closest known word, if it's close enough; otherwise null. */
export function snapWord(word: string, known: readonly string[] = KNOWN): string | null {
  if (word.length < 5 || known.includes(word)) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const k of known) {
    if (Math.abs(k.length - word.length) > 2) continue;
    const dist = editDistance(word, k);
    if (dist < bestD) {
      bestD = dist;
      best = k;
    }
  }
  return best && bestD <= tolerance(best.length) ? best : null;
}

const LEADING_FILLERS =
  /^(?:(?:um+|uh+|er+|hmm+|okay|ok|so|hey|alright|all right|please|yeah)[,\s]+|(?:can you|could you|would you|will you|go ahead and|i want to|i wanna|i need to|i have to|i've got to|i gotta|remind me to|remind me|don't let me forget to|don't forget to|make sure i|add|put|create|new|set)\s+)+/;

/** Turns a run of number words ("fifty nine") into a value, or null. */
function wordsToNumber(words: string[]): number | null {
  if (!words.length) return null;
  if (words.length === 1) {
    const w = words[0];
    if (w in ONES) return ONES[w];
    if (w in TENS) return TENS[w];
    return null;
  }
  if (words.length === 2 && words[0] in TENS && words[1] in ONES && ONES[words[1]] < 10 && ONES[words[1]] > 0) return TENS[words[0]] + ONES[words[1]];
  return null;
}

const NUM_WORD = `(?:${[...Object.keys(TENS), ...Object.keys(ONES)].join("|")})`;

export function normalizeSpoken(input: string): string {
  let s = ` ${input.toLowerCase().replace(/[“”"]/g, '"').replace(/[’]/g, "'")} `;

  // Fillers anywhere ("um", "uh", "like," between words).
  s = s.replace(/\s(?:um+|uh+|er+|hmm+)[,.]?(?=\s)/g, " ");
  s = s.replace(/\s+/g, " ");

  // "p m" / "p.m." / "a m" → pm / am
  s = s.replace(/\b([ap])\.?\s?m\.?(?=\s|$|[,.!?])/g, "$1m");

  // Times said in words: "eleven fifty nine pm", "three thirty", "seven o'clock", "five oh five".
  const hourWord = `(${Object.keys(ONES).filter((w) => ONES[w] >= 1 && ONES[w] <= 12).join("|")})`;
  s = s.replace(new RegExp(`\\b${hourWord}\\s+o'?\\s?clock\\b`, "g"), (_, h) => `${ONES[h]}:00`);
  s = s.replace(new RegExp(`\\b${hourWord}\\s+(oh\\s+(?:one|two|three|four|five|six|seven|eight|nine)|(?:twenty|thirty|forty|fifty)(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|fifteen|ten|eleven|twelve|thirteen|fourteen|sixteen|seventeen|eighteen|nineteen)\\b(?=\\s*(?:am|pm|in the|at night|tonight|\\s|$))`, "g"), (m, h, mins: string) => {
    const words = mins.replace(/-/g, " ").split(/\s+/);
    const minute = words[0] === "oh" ? ONES[words[1]] : wordsToNumber(words);
    return minute === null || minute > 59 ? m : `${ONES[h]}:${String(minute).padStart(2, "0")}`;
  });

  // Ordinals: "the fifth" → "the 5th", "november twentieth" → "november 20th", "twenty first" → "21st".
  s = s.replace(/\b(twenty|thirty)[\s-](first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/g, (_, t, o) => {
    const n = TENS[t] + ORDINALS[o];
    return `${n}${n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"}`;
  });
  s = s.replace(new RegExp(`\\b(the|on|${["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].join("|")})\\s+(${Object.keys(ORDINALS).join("|")})\\b`, "g"), (_, before, o) => {
    const n = ORDINALS[o];
    return `${before} ${n}${n === 1 || n === 21 || n === 31 ? "st" : n === 2 || n === 22 ? "nd" : n === 3 || n === 23 ? "rd" : "th"}`;
  });

  // Remaining number words → digits ("twenty dollars", "three sets of ten", "at three").
  s = s.replace(new RegExp(`\\b(${Object.keys(TENS).join("|")})[\\s-](one|two|three|four|five|six|seven|eight|nine)\\b`, "g"), (_, t, o) => String(TENS[t] + ONES[o]));
  s = s.replace(new RegExp(`\\b(${Object.keys(TENS).join("|")}|${Object.keys(ONES).filter((w) => w !== "oh" && w !== "zero" && w !== "one").join("|")})\\b`, "g"), (w) =>
    String(w in TENS ? TENS[w] : ONES[w]),
  );
  // "one" only becomes 1 next to units/times ("one hour", "at one"), so "one more thing" stays.
  s = s.replace(/\bone(?=\s+(?:hour|hours|hr|minute|min|mins|dollar|dollars|bucks|pm|am|set|sets|rep|reps|mile|miles)\b)/g, "1");
  s = s.replace(/\b(at|by)\s+one\b/g, "$1 1");
  // "a dollar fifty" / "twelve fifty" for money is rare in speech here; "$" handled by the parser.

  // "at 3 in the afternoon" / "at 9 in the morning" / "8 at night" / "tonight at 8".
  s = s.replace(/\b(\d{1,2})(:\d{2})?\s+(?:o'?clock\s+)?in the (morning)\b/g, "$1$2am");
  s = s.replace(/\b(\d{1,2})(:\d{2})?\s+(?:o'?clock\s+)?(?:in the (?:afternoon|evening)|at night)\b/g, "$1$2pm");
  s = s.replace(/\btonight at (\d{1,2})(:\d{2})?\b(?!\s*[ap]m)/g, "tonight at $1$2pm");

  // "11:59 pm" → "11:59pm"
  s = s.replace(/(\d)\s+([ap]m)\b/g, "$1$2");

  // "this coming friday" → "friday"; possessives "friday's" → "friday".
  s = s.replace(/\bthis coming\s+/g, "");
  s = s.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)'s\b/g, "$1");

  // Snap misheard words to known ones ("wensday" → "wednesday").
  s = s.replace(/\b[a-z]{5,}\b/g, (w) => snapWord(w) ?? w);

  // Leading openers ("can you add", "remind me to").
  s = s.trim().replace(LEADING_FILLERS, "");
  return s.replace(/\s+/g, " ").trim();
}

export const SPOKEN_NUMBER_WORD = NUM_WORD;
