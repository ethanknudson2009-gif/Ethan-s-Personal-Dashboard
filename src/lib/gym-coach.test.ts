import { describe, expect, it } from "vitest";
import { coachTips, type CoachExercise, type CoachWorkout } from "./gym-coach";

const EX: CoachExercise[] = [
  { id: "bench", name: "Bench press", muscle: "chest" },
  { id: "squat", name: "Squat", muscle: "legs" },
  { id: "lat", name: "Lateral raise", muscle: "shoulders" },
  { id: "curl", name: "Bicep curl", muscle: "biceps" },
  { id: "row", name: "Barbell row", muscle: "back" },
  { id: "push", name: "Push-ups", muscle: "chest", bodyweight: true },
  { id: "tri", name: "Tricep pushdown", muscle: "triceps" },
  { id: "ohp", name: "Overhead press", muscle: "shoulders" },
];
const TODAY = "2026-11-23";
const sets = (id: string, w: number, ...reps: number[]) => reps.map((r) => ({ exerciseId: id, weightLb: w, reps: r }));
const day = (date: string, ...s: ReturnType<typeof sets>[]): CoachWorkout => ({ date, day: null, sets: s.flat() });
const tips = (ws: CoachWorkout[], opts = {}) => coachTips(ws, EX, TODAY, opts);
const ids = (ws: CoachWorkout[]) => tips(ws).map((t) => t.id);

describe("the gym coach", () => {
  it("lots of reps → go heavier, with a real number", () => {
    const t = tips([day("2026-11-20", sets("bench", 135, 16, 15, 15))]);
    const tip = t.find((x) => x.id === "heavier-bench")!;
    expect(tip.title).toBe("Go heavier on Bench press");
    expect(tip.why).toContain("135 lb × 16, 15, 15");
    expect(tip.why).toMatch(/Try 1[45]\d lb/);
  });

  it("top of the range twice in a row → add weight (10 lb on squats, 5 on curls)", () => {
    const ws = [day("2026-11-16", sets("squat", 185, 12, 12, 12), sets("curl", 30, 12, 13)), day("2026-11-20", sets("squat", 185, 12, 12, 13), sets("curl", 30, 12, 12))];
    const t = tips(ws);
    expect(t.find((x) => x.id === "progress-squat")!.why).toContain("195 lb");
    expect(t.find((x) => x.id === "progress-curl")!.why).toContain("35 lb");
  });

  it("one session at the top → 'ready to move up soon'", () => {
    expect(ids([day("2026-11-20", sets("curl", 30, 12, 12, 12))])).toContain("ready-curl");
  });

  it("grinding 2–4 reps on a small lift → drop the weight", () => {
    const tip = tips([day("2026-11-20", sets("lat", 40, 3, 3, 2))]).find((x) => x.id === "lighter-lat")!;
    expect(tip.why).toContain("35 lb");
  });

  it("heavy low reps on a big lift are fine (strength work)", () => {
    expect(ids([day("2026-11-20", sets("squat", 315, 3, 3, 3))])).not.toContain("lighter-squat");
  });

  it("no new best in 3 sessions over 2+ weeks → stalled", () => {
    const ws = [
      day("2026-10-20", sets("bench", 185, 8, 8, 8)),
      day("2026-11-02", sets("bench", 185, 8, 7, 7)),
      day("2026-11-09", sets("bench", 185, 8, 8, 7)),
      day("2026-11-20", sets("bench", 185, 7, 7, 7)),
    ];
    expect(ids(ws)).toContain("stall-bench");
  });

  it("real progress gets called out", () => {
    const ws = [
      day("2026-10-20", sets("bench", 155, 8, 8)),
      day("2026-11-02", sets("bench", 165, 8, 8)),
      day("2026-11-09", sets("bench", 175, 8, 8)),
      day("2026-11-20", sets("bench", 185, 8, 8)),
    ];
    const tip = tips(ws).find((x) => x.id === "gain-bench")!;
    expect(tip.tone).toBe("good");
    expect(tip.title).toMatch(/up \d+%/);
  });

  it("reps crashing across sets at the same weight → rest longer", () => {
    expect(ids([day("2026-11-20", sets("bench", 135, 12, 8, 5))])).toContain("rest-bench");
  });

  it("only one set every time → add a set", () => {
    expect(ids([day("2026-11-17", sets("curl", 30, 10)), day("2026-11-20", sets("curl", 30, 10))])).toContain("sets-curl");
  });

  it("bodyweight moves never get weight advice", () => {
    const t = ids([day("2026-11-20", sets("push", 0, 30, 25, 20))]);
    expect(t.filter((x) => /^(?:heavier|progress|ready|lighter|stall)-push$/.test(x))).toEqual([]);
  });

  it("muscles skipped for 2+ weeks get a nudge with what to do", () => {
    const ws = ["2026-11-10", "2026-11-14", "2026-11-18", "2026-11-21"].map((d) => day(d, sets("bench", 135, 10, 10), sets("squat", 185, 8, 8)));
    const miss = tips(ws).filter((t) => t.id.startsWith("miss-"));
    expect(miss.length).toBeGreaterThan(0);
    expect(miss.length).toBeLessThanOrEqual(3);
    expect(miss[0].why).toMatch(/Add .+ to your .+ day/);
  });

  it("way more pushing than pulling → balance it", () => {
    const ws = ["2026-11-10", "2026-11-14", "2026-11-18"].map((d) => day(d, sets("bench", 135, 10, 10, 10), sets("ohp", 95, 10, 10), sets("tri", 50, 12, 12)));
    expect(ids(ws)).toContain("balance-pull");
  });

  it("a long gap says what's up next", () => {
    const tip = tips([day("2026-11-15", sets("bench", 135, 10))], { nextDay: "Legs" }).find((t) => t.id === "gap")!;
    expect(tip.title).toBe("8 days since your last workout");
    expect(tip.why).toContain("Legs is up next");
  });

  it("nothing logged → no tips; skipped days don't count", () => {
    expect(tips([])).toEqual([]);
    expect(tips([{ date: "2026-11-20", day: "Legs", skipped: true, sets: [] }])).toEqual([]);
  });

  it("the most useful tips come first", () => {
    const t = tips([day("2026-11-20", sets("bench", 135, 16, 15, 15), sets("curl", 30, 12, 12, 12))]);
    expect(t[0].id).toBe("heavier-bench");
  });
});
