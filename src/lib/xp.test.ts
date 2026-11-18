import { describe, expect, it } from "vitest";
import { levelInfo, levelTitle, totalXp, xpForLevel } from "./xp";

describe("xp", () => {
  it("adds up tasks, habits and focus", () => {
    expect(totalXp({ tasksDone: 3, habitCheckins: 4, focusMinutes: 52 })).toBe(30 + 20 + 10);
    expect(totalXp({ tasksDone: 0, habitCheckins: 0, focusMinutes: 0 })).toBe(0);
  });

  it("levels need 100 more XP each time", () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it("level and progress toward the next", () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, needed: 100, progress: 0 });
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100)).toMatchObject({ level: 2, into: 0, needed: 200 });
    expect(levelInfo(450)).toMatchObject({ level: 3, into: 150, needed: 300, progress: 0.5 });
  });

  it("titles", () => {
    expect(levelTitle(1)).toBe("Rookie");
    expect(levelTitle(3)).toBe("Starter");
    expect(levelTitle(40)).toBe("Legend");
  });
});
