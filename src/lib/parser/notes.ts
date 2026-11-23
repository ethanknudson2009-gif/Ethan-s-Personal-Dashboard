/**
 * Turning long, rambling speech into a clean title and tidy notes.
 *
 * People don't talk in titles. They say "okay so um I need to write my
 * English essay due Friday, it needs to be five pages, and also make sure I
 * use three sources". This file:
 *  - drops the warm-up words at the start ("okay so I need to"),
 *  - organizes the extra details into short bullet points.
 */

/** "In the morning…", "after school…", "at work…": when/where you'll do it, said first. */
export const CONTEXT_LEAD =
  /^(?:in the (?:morning|afternoon|evening)|this (?:morning|afternoon|evening)|first thing(?: in the morning)?|after (?:school|work|class|lunch|practice)|before (?:school|work|class)|at (?:lunch|work|school|the office|prmi|primary)|for (?:work|school|prmi|primary)|on my (?:lunch|break)|later(?: on| today)?)\b[\s,]*(?=\S)/i;

/** Warm-up words people say before the actual thing. Removed from the start (repeatedly). */
const LEAD_INS = [
  /^(?:okay|ok|alright|all right|so|um+|uh+|hey|yeah|yes|well|right|oh|also|and also|and then|then|plus|hmm+|basically|real quick|quick|dude|bro|bruh|yo|ugh+|omg|dang|shoot|man|honestly|literally|anyway|anyways|wait|oh wait|actually|like|i mean|you know|after that|and after that|but)\b[\s,.:!-]*/i,
  // How people talk before the point: "I just remembered", "I was thinking I should", "put down that".
  /^(?:that(?= i\b)|i (?:just |totally |completely |almost |kinda |kind of )?(?:remembered|forgot(?: to)?|realized|noticed)(?: that)?|i was (?:just )?thinking(?: that)?|i(?:'m| am) thinking(?: that)?|i think(?: that)?(?= i\b)|i guess(?= i\b)|i feel like(?= i\b)|so the thing is|the thing is|(?:put|write) (?:it )?down that|add that|put that|make a note that|note that|remember that|just so you know|heads up|i(?:'m| am) supposed to|i should(?: probably| really| definitely)?|i probably should|i really should|i(?:'m| am) (?:going|gonna) to(?! the\b)|i(?:'m| am) gonna|i want to start|i wanna|i(?:'d| would) like to|i(?:'m| am) trying to|i(?:'ve| have) been meaning to|(?:mike|he|she|they|my [a-z]+) asked (?:me )?if i (?:could|can)|(?:mike|he|she|they|my [a-z]+) asked me to)\b[\s,:-]*/i,
  /^(?:(?:mike|he|she|they|my (?:boss|manager|mom|dad|teacher|coach|lo)|the teacher) (?:wants|asked|told|needs) me to|(?:mike|he|she) said to|remind me (?:to|that i (?:need|have) to|that)|remember to|don'?t forget to|make sure to|don'?t let me forget (?:to )?|can you (?:add|remind me to|put)?|could you (?:add)?|please|add (?:a )?(?:task|reminder|to-?do)(?: to| for| that)?|add(?![^.!?]*\b(?:to|into|onto|in) (?:the|my|his|her|their|our|a|an) (?!list\b|to-?do|todo|tasks|reminders)[a-z])|new (?:task|reminder|to-?do)|put (?:on my list|down)(?: to)?|make (?:a )?(?:task|reminder|note) (?:to|for|that)?)\b[\s,:-]*/i,
  /^(?:i (?:also |still )?(?:need|have|want|gotta|got|should|must|ought) to|i'?ve got to|i'?ve gotta|i gotta|i got to|i'?ll need to|i need|need to|have to|gotta|got to)\b[\s,]*(?=\S)/i,
  CONTEXT_LEAD,
  /^(?:i have (?:a|an|my|some|the)|i'?ve got (?:a|an|my|some|the)|i got (?:a|an|my|some|the)|there'?s (?:a|an|my|the)|there is (?:a|an|my|the)|we have (?:a|an|the)|i'?ve got|i have)\b[\s,]*(?=\S)/i,
];

/** Remove the warm-up words at the start. Keeps the rest exactly (case and all). */
export function stripLeadIn(text: string, opts: { context?: boolean } = {}): string {
  let s = text.trimStart();
  const leads = opts.context === false ? LEAD_INS.filter((re) => re !== CONTEXT_LEAD) : LEAD_INS;
  for (let guard = 0; guard < 8; guard++) {
    const before = s;
    for (const re of leads) {
      const m = re.exec(s);
      // Never strip everything: "I need to" alone stays.
      const rest = s.slice(m?.[0].length ?? 0).trim();
      if (m && m[0].length > 0 && rest.length > 0 && !/^(?:to|a|an|the|it|that)$/i.test(rest)) s = s.slice(m[0].length).trimStart();
    }
    if (s === before) break;
  }
  return s;
}

/**
 * Words that start a new point inside the notes. The match is removed only
 * when it's pure glue ("also", "and then"); words with meaning ("make sure",
 * "bring") stay in the bullet.
 */
const POINT_GLUE =
  /(?<=^|[\s,;])(?:and also|also|plus|and then|then|oh and|oh yeah and|oh yeah|another thing(?: is)?|one more thing(?: is)?|the other thing(?: is)?|on top of that|after that|besides that|additionally)\b[\s,:]*/gi;
const POINT_STARTS =
  /(?<!\b(?:the|my|to|sure|and|please|will|should|can|gotta|must|need|have|also|because|cause|since|if|when|that|but|until|unless|where|said|says|think|know|hope|guess))[\s,;](?=(?:and )?(?:make sure|be sure|remember|don'?t forget|dont forget|bring|the teacher said|my teacher said|teacher said|(?:she|he|they|mike) said|(?:he|she|they|mike) wants|it needs|it has to|it should|it must|it'?s due|it is due|it'?s worth|it is worth|it covers|it'?s on|it is on|it'?s about|it is about|it'?ll be|it will be|i need to|i have to|i should|i gotta|i'?ve got to|we need to|we have to|i'?ll|i will|i have (?:some|a|an|the|my|these|those)|(?:it|she|he|they) (?:came|went|got|is|isn'?t|was|wasn'?t|has|hasn'?t|had|did|didn'?t|does|doesn'?t|can'?t|won'?t|already)|ask (?:him|her|them|mike|about)|tell (?:him|her|them|mike)|and ask|and tell|text (?:him|her|them)|call (?:him|her|them))\b)/gi;

/** Openers rewritten so each bullet reads cleanly ("it needs to be 5 pages" → "Needs to be 5 pages"). */
const OPENERS: [RegExp, string][] = [
  [/^(?:and|so|but then|then|also|plus|oh|okay|ok|um+|uh+|like|yeah|well|and so|so yeah)\b[\s,]*/i, ""],
  [/^(?:i (?:also |still )?(?:need|have|gotta|got|should|must) to|i'?ve got to|i gotta|we (?:need|have) to|need to|have to|gotta)\s+/i, ""],
  [/^it needs to\b/i, "Needs to"],
  [/^it has to\b/i, "Has to"],
  [/^it should\b/i, "Should"],
  [/^it must\b/i, "Must"],
  [/^it(?:'s| is) about\b/i, "About"],
  [/^it(?:'s| is) worth\b/i, "Worth"],
  [/^it covers\b/i, "Covers"],
  [/^it(?:'s| is) on\b/i, "On"],
  [/^it(?:'s| is) due\b/i, "Due"],
  [/^(?:the |my )?teacher said\b(?: that)?/i, "Teacher said"],
  [/^notes?\s*:\s*/i, ""],
  [/^details?\s*:\s*/i, ""],
];

function tidyPoint(raw: string): string {
  let s = raw.replace(/^[\s,.;:!?–—-]+/, "").replace(/[\s,;:–—-]+$/, "").trim();
  for (let guard = 0; guard < 4; guard++) {
    const before = s;
    for (const [re, to] of OPENERS) s = s.replace(re, to).trim();
    if (s === before) break;
  }
  // Dangling glue at the end: "…three sources and".
  s = s.replace(/\s+(?:and|so|but|or|also|then|um+|uh+)$/i, "").replace(/[\s,;:]+$/, "");
  s = s.replace(/\bi\b/g, "I").replace(/\bi'(m|ll|ve|d)\b/gi, "I'$1");
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  // End without a stray period (bullets look cleaner), keep ? and !.
  return s.replace(/\.$/, "");
}

/** Split the extra details into separate points. Returns the points in order. */
export function notePoints(text: string): string[] {
  const marked = text
    .replace(/\r/g, "")
    .replace(/(?:^|\n)\s*(?:[-*•·]|\d+[.)])\s+/g, "\n")
    .replace(/([.!?])\s+/g, "$1\n")
    .replace(/;\s*/g, "\n")
    .replace(POINT_GLUE, "\n")
    .replace(POINT_STARTS, "\n");
  const seen = new Set<string>();
  const points: string[] = [];
  for (const part of marked.split("\n")) {
    const p = tidyPoint(part);
    const key = p.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!p || key.length < 2 || seen.has(key)) continue;
    // A tiny leftover ("Yeah", "That's it") isn't a point.
    if (/^(?:that'?s it|that'?s all|yeah|ok|okay|thanks?|thank you|done|and|so|um|uh)$/i.test(p)) continue;
    seen.add(key);
    points.push(p);
  }
  return points;
}

/** Tidy notes: one point stays a sentence; several become "• point" lines. */
export function organizeNotes(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const points = notePoints(text);
  if (!points.length) return null;
  return points.length === 1 ? points[0] : points.map((p) => `• ${p}`).join("\n");
}
