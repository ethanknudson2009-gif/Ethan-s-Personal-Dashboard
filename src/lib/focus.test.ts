import { describe, expect, it } from "vitest";
import { addMinutes, clock, minutesDone, msLeft, pause, resume, startSession } from "./focus";

const task = { id: "t", title: "Outline", color: null };
const MIN = 60_000;

describe("focus timer", () => {
  it("counts down from the end time", () => {
    const s = startSession(task, 25, 0);
    expect(msLeft(s, 0)).toBe(25 * MIN);
    expect(msLeft(s, 10 * MIN)).toBe(15 * MIN);
    expect(msLeft(s, 30 * MIN)).toBe(0); // never negative
  });

  it("pause holds the time; resume continues from there", () => {
    let s = startSession(task, 25, 0);
    s = pause(s, 5 * MIN);
    expect(msLeft(s, 60 * MIN)).toBe(20 * MIN); // time passing while paused doesn't count
    s = resume(s, 60 * MIN);
    expect(msLeft(s, 70 * MIN)).toBe(10 * MIN);
  });

  it("+5 minutes, running or paused", () => {
    expect(msLeft(addMinutes(startSession(task, 25, 0), 5, 0), 0)).toBe(30 * MIN);
    expect(msLeft(addMinutes(pause(startSession(task, 25, 0), 0), 5, 0), 99)).toBe(30 * MIN);
  });

  it("minutes done for logging", () => {
    const s = startSession(task, 25, 0);
    expect(minutesDone(s, 12 * MIN + 20_000)).toBe(12);
    expect(minutesDone(s, 40 * MIN)).toBe(25);
  });

  it("formats the clock", () => {
    expect(clock(25 * MIN)).toBe("25:00");
    expect(clock(61_000)).toBe("1:01");
    expect(clock(500)).toBe("0:01");
    expect(clock(0)).toBe("0:00");
  });
});
