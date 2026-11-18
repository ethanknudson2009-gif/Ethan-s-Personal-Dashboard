/**
 * Speech recognizers return several guesses at what you said. We parse each
 * one and keep the guess that "makes the most sense" to the dashboard: it
 * names one of your classes, has a day we understand, and leaves few doubts.
 * Ties go to the recognizer's own first choice.
 */
import { parse, type ParseContext } from "./index";

export function scoreHearing(text: string, ctx: ParseContext): number {
  const d = parse(text, { ...ctx, spoken: true });
  let score = d.confidence;
  if (d.classId) score += 0.35;
  if (d.when) score += 0.3;
  if (d.type !== "task") score += 0.05; // recognized as something specific
  return score;
}

export function pickBestHearing(alternatives: string[], ctx: ParseContext): string {
  const options = alternatives.map((a) => a.trim()).filter(Boolean);
  if (options.length <= 1) return options[0] ?? "";
  let best = options[0];
  let bestScore = scoreHearing(best, ctx);
  for (const option of options.slice(1)) {
    const s = scoreHearing(option, ctx);
    if (s > bestScore + 0.001) {
      best = option;
      bestScore = s;
    }
  }
  return best;
}
