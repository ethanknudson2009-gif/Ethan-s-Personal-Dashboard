import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { availableMinutes, cushion, DEFAULT_STUDY_SETTINGS as S, formatMinutes, labelFor } from "./index";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);

// "Now" = Tuesday Nov 10, 2026 at 4:00 PM in Phoenix.
const NOW = at("2026-11-10", 16);

describe("availableMinutes", () => {
  it("Tue 4pm → Fri 11:59pm = Tue + Wed + Thu + Fri evenings = 8 h", () => {
    expect(availableMinutes(NOW, at("2026-11-13", 23, 59), S)).toBe(480);
  });

  it("a morning deadline doesn't count that day", () => {
    // Due Wed 8:00 AM: only Tuesday evening is left.
    expect(availableMinutes(NOW, at("2026-11-11", 8), S)).toBe(120);
  });

  it("weekends have no study time by default", () => {
    const friday = at("2026-11-13", 16);
    expect(availableMinutes(friday, at("2026-11-16", 8), S)).toBe(120); // just Friday
    expect(availableMinutes(friday, at("2026-11-16", 23, 59), S)).toBe(240); // Friday + Monday
  });

  it("late at night, today only counts until study end (10 PM)", () => {
    const lateTuesday = at("2026-11-10", 21, 30);
    expect(availableMinutes(lateTuesday, at("2026-11-11", 23, 59), S)).toBe(30 + 120);
    const afterTen = at("2026-11-10", 22, 30);
    expect(availableMinutes(afterTen, at("2026-11-11", 23, 59), S)).toBe(120);
  });

  it("is zero once the deadline has passed", () => {
    expect(availableMinutes(NOW, at("2026-11-09", 23, 59), S)).toBe(0);
  });

  it("respects custom study settings", () => {
    const weekendWarrior = { ...S, studyMinutes: [180, 60, 60, 60, 60, 60, 180] };
    const friday = at("2026-11-13", 16);
    expect(availableMinutes(friday, at("2026-11-16", 8), weekendWarrior)).toBe(60 + 180 + 180);
  });
});

describe("cushion", () => {
  it("one assignment: 8 h available − 2 h needed = 6 h ahead", () => {
    const r = cushion([{ id: "lab", dueAt: at("2026-11-13", 23, 59), estimateMinutes: 120, minutesDone: 0 }], S, NOW);
    expect(r.get("lab")).toMatchObject({ minutes: 360, label: "ahead", availableMinutes: 480, neededMinutes: 120 });
  });

  it("assignments share time: earlier work counts against later deadlines", () => {
    const r = cushion(
      [
        { id: "essay", dueAt: at("2026-11-13", 23, 59), estimateMinutes: 120, minutesDone: 0 },
        { id: "project", dueAt: at("2026-11-11", 8), estimateMinutes: 200, minutesDone: 0 },
      ],
      S,
      NOW,
    );
    expect(r.get("project")).toMatchObject({ minutes: 120 - 200, label: "behind" });
    expect(r.get("essay")).toMatchObject({ minutes: 480 - 320, label: "ahead" });
  });

  it("work already done reduces what's needed", () => {
    const r = cushion([{ id: "x", dueAt: at("2026-11-11", 8), estimateMinutes: 150, minutesDone: 60 }], S, NOW);
    expect(r.get("x")).toMatchObject({ minutes: 30, label: "tight" });
  });

  it("uses a 30-minute default when there's no estimate, and says so", () => {
    const r = cushion([{ id: "x", dueAt: at("2026-11-11", 8), estimateMinutes: null, minutesDone: 0 }], S, NOW);
    expect(r.get("x")).toMatchObject({ minutes: 90, estimateMissing: true });
  });

  it("overdue work is behind by everything still needed", () => {
    const r = cushion([{ id: "late", dueAt: at("2026-11-09", 23, 59), estimateMinutes: 45, minutesDone: 0 }], S, NOW);
    expect(r.get("late")).toMatchObject({ minutes: -45, label: "behind" });
  });
});

describe("labels and formatting", () => {
  it("labels by threshold", () => {
    expect(labelFor(60)).toBe("ahead");
    expect(labelFor(59)).toBe("tight");
    expect(labelFor(0)).toBe("tight");
    expect(labelFor(-1)).toBe("behind");
  });

  it("formats minutes for people", () => {
    expect(formatMinutes(90)).toBe("1 h 30 m");
    expect(formatMinutes(45)).toBe("45 m");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(-80)).toBe("−1 h 20 m");
  });
});
