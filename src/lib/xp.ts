/**
 * XP and levels (pure, tested). XP is worked out from what you've actually
 * done, so nothing can get out of sync:
 *   +10 per task/assignment finished, +5 per habit check-in,
 *   +1 per 5 minutes of focus.
 * Each level needs 100 XP more than the one before (100, 200, 300 …), so
 * early levels come fast and later ones feel earned.
 */

export const XP = { task: 10, habit: 5, focusMinutesPerPoint: 5 } as const;

export function totalXp(counts: { tasksDone: number; habitCheckins: number; focusMinutes: number }): number {
  return counts.tasksDone * XP.task + counts.habitCheckins * XP.habit + Math.floor(counts.focusMinutes / XP.focusMinutesPerPoint);
}

/** XP needed to *reach* level n (level 1 = 0, level 2 = 100, level 3 = 300, level 4 = 600…). */
export function xpForLevel(n: number): number {
  return (100 * (n - 1) * n) / 2;
}

export function levelInfo(xp: number): { level: number; into: number; needed: number; progress: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - start, needed: next - start, progress: (xp - start) / (next - start) };
}

const TITLES = ["Rookie", "Starter", "Grinder", "Focused", "Locked In", "Machine", "Legend"];
/** A fun title for the level. */
export function levelTitle(level: number): string {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))];
}
