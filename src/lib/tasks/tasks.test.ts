import { describe, expect, it } from "vitest";
import { fromLocal, toLocalDate } from "@/lib/time";
import { describeRepeat, nextOccurrence, parseRepeat, presetFromRule, repeatFromForm } from "./index";

const PHX = "America/Phoenix";

describe("repeat presets", () => {
  it("turns form choices into rules and back", () => {
    for (const preset of ["daily", "weekly", "biweekly", "monthly"]) {
      expect(presetFromRule(repeatFromForm(preset)).preset).toBe(preset);
    }
    expect(repeatFromForm("after_days", 7)).toEqual({ mode: "after_completion", every: 7, unit: "day" });
    expect(presetFromRule(repeatFromForm("after_days", 7))).toEqual({ preset: "after_days", afterDays: 7 });
    expect(repeatFromForm("none")).toBeNull();
    expect(repeatFromForm("after_days", 0)).toBeNull();
  });

  it("describes rules in words", () => {
    expect(describeRepeat(repeatFromForm("weekly"))).toBe("Every week");
    expect(describeRepeat(repeatFromForm("biweekly"))).toBe("Every 2 weeks");
    expect(describeRepeat(repeatFromForm("after_days", 1))).toBe("1 day after done");
    expect(describeRepeat(repeatFromForm("after_days", 7))).toBe("7 days after done");
    expect(describeRepeat(null)).toBeNull();
  });

  it("ignores malformed saved rules", () => {
    expect(parseRepeat({ mode: "weird", every: 1, unit: "day" })).toBeNull();
    expect(parseRepeat("every day")).toBeNull();
    expect(parseRepeat({ mode: "fixed", every: 1, unit: "week" })).toEqual({ mode: "fixed", every: 1, unit: "week" });
  });
});

describe("nextOccurrence", () => {
  const due = fromLocal("2026-11-09", { hour: 23, minute: 59 }, PHX).toISOString(); // Mon 11:59 PM

  it("weekly homework checked off on time → next Monday 11:59 PM", () => {
    const next = nextOccurrence({ due_at: due, repeat: repeatFromForm("weekly") }, new Date("2026-11-09T20:00:00Z"), PHX);
    expect(toLocalDate(next!, PHX)).toBe("2026-11-16");
  });

  it("no repeat, or no due date → nothing next", () => {
    expect(nextOccurrence({ due_at: due, repeat: null }, new Date(), PHX)).toBeNull();
    expect(nextOccurrence({ due_at: null, repeat: repeatFromForm("weekly") }, new Date(), PHX)).toBeNull();
  });
});
