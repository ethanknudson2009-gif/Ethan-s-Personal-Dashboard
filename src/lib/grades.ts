/**
 * Grade math (pure, tested).
 *
 * Weighted classes: each category (Tests 50%, Homework 30%, …) is averaged
 * by points, then combined by weight. Categories with no grades yet are
 * left out and the rest are scaled up, which is how most teachers' grade
 * books show a running grade. With no categories, it's simply total points.
 */

export type Category = { id: string; weight: number };
export type Grade = { categoryId: string | null; earned: number; possible: number; whatIf?: boolean };

/** Current grade as a percent (0–100+), or null if there's nothing graded yet. */
export function average(categories: Category[], grades: Grade[], includeWhatIf = false): number | null {
  const used = grades.filter((g) => g.possible > 0 && (includeWhatIf || !g.whatIf));
  if (!used.length) return null;

  const weighted = categories.filter((c) => c.weight > 0);
  if (!weighted.length) {
    const earned = used.reduce((s, g) => s + g.earned, 0);
    const possible = used.reduce((s, g) => s + g.possible, 0);
    return (earned / possible) * 100;
  }

  let total = 0;
  let weightUsed = 0;
  for (const c of weighted) {
    const inCat = used.filter((g) => g.categoryId === c.id);
    if (!inCat.length) continue;
    const pct = inCat.reduce((s, g) => s + g.earned, 0) / inCat.reduce((s, g) => s + g.possible, 0);
    total += pct * c.weight;
    weightUsed += c.weight;
  }
  // Grades without a category (when categories exist) are ignored in a weighted class.
  return weightUsed ? (total / weightUsed) * 100 : null;
}

const LETTERS: [number, string][] = [
  [93, "A"], [90, "A-"], [87, "B+"], [83, "B"], [80, "B-"], [77, "C+"], [73, "C"], [70, "C-"], [67, "D+"], [63, "D"], [60, "D-"],
];

export function letter(percent: number | null): string {
  if (percent === null) return "—";
  return LETTERS.find(([min]) => percent >= min)?.[1] ?? "F";
}

/**
 * Points needed on one more assignment (worth `possible` points, in
 * `categoryId`) to reach `target` percent overall. Returns null when it's
 * impossible even with a perfect score, 0 when you're already there.
 */
export function neededFor(target: number, categories: Category[], grades: Grade[], categoryId: string | null, possible: number): number | null {
  const withScore = (earned: number) => average(categories, [...grades.filter((g) => !g.whatIf), { categoryId, earned, possible }]) ?? 0;
  if (withScore(0) >= target) return 0;
  if (withScore(possible) < target) return null;
  // The average rises steadily with the score, so we can search for the point it crosses the target.
  let lo = 0;
  let hi = possible;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (withScore(mid) >= target) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi * 10) / 10;
}

export function formatPercent(p: number | null): string {
  return p === null ? "—" : `${p.toFixed(1)}%`;
}
