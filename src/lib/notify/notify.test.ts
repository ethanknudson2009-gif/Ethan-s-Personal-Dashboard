import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { planNotifications, type NotifyTask, type PlanInput } from "./index";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);

const speechWed: NotifyTask = { id: "s", title: "Outline", className: "Speech", dueAt: at("2026-11-18", 23, 59), dueHasTime: false };
const anatomyTue: NotifyTask = { id: "a", title: "Lab report", className: "Human Anatomy", dueAt: at("2026-11-17", 23, 59), dueHasTime: false };
const quizTue3pm: NotifyTask = { id: "q", title: "Quiz", className: "College Algebra", dueAt: at("2026-11-17", 15), dueHasTime: true };

const base = (o: Partial<PlanInput>): PlanInput => ({
  now: at("2026-11-17", 7, 5), // Tuesday 7:05 AM
  timeZone: PHX,
  tasks: [],
  inboxCount: 0,
  alreadySent: new Set(),
  morningAt: { hour: 7, minute: 0 },
  eveningAt: { hour: 20, minute: 0 },
  ...o,
});

describe("morning summary", () => {
  it("Ethan's example: due Wednesday → reminded Tuesday morning", () => {
    const [n] = planNotifications(base({ tasks: [speechWed] }));
    expect(n).toMatchObject({ kind: "morning", body: "Tomorrow: Speech: Outline" });
  });

  it("lists today, tomorrow, overdue and the Inbox", () => {
    const old: NotifyTask = { ...anatomyTue, id: "o", dueAt: at("2026-11-16", 23, 59) };
    const [n] = planNotifications(base({ tasks: [anatomyTue, speechWed, old], inboxCount: 2 }));
    expect(n.title).toBe("Good morning: 2 due today & tomorrow");
    expect(n.body).toBe("Today: Human Anatomy: Lab report\nTomorrow: Speech: Outline\n1 overdue\n2 in your Inbox to review");
  });

  it("not before 7, not after noon, never twice, and silent when nothing's due", () => {
    expect(planNotifications(base({ now: at("2026-11-17", 6, 50), tasks: [speechWed] }))).toEqual([]);
    expect(planNotifications(base({ now: at("2026-11-17", 12, 5), tasks: [speechWed] }))).toEqual([]);
    expect(planNotifications(base({ tasks: [speechWed], alreadySent: new Set(["morning"]) }))).toEqual([]);
    expect(planNotifications(base({ tasks: [] }))).toEqual([]);
  });
});

describe("evening preview", () => {
  it("at 8 PM lists what's due tomorrow", () => {
    const [n] = planNotifications(base({ now: at("2026-11-17", 20, 10), tasks: [speechWed, anatomyTue] }));
    expect(n).toMatchObject({ kind: "evening", title: "Due tomorrow (1)", body: "Speech: Outline" });
  });

  it("adds habits not done yet, and nudges even with nothing due tomorrow", () => {
    const [both] = planNotifications(base({ now: at("2026-11-17", 20, 10), tasks: [speechWed], habitsLeft: ["Gym", "Read 20 min"] }));
    expect(both.body).toBe("Speech: Outline\nHabits left today: Gym, Read 20 min");
    const [onlyHabits] = planNotifications(base({ now: at("2026-11-17", 20, 10), tasks: [], habitsLeft: ["Gym"] }));
    expect(onlyHabits).toMatchObject({ title: "Still time today", body: "Habits left today: Gym", url: "/life" });
  });

  it("nothing tomorrow → no evening message", () => {
    expect(planNotifications(base({ now: at("2026-11-17", 20, 10), tasks: [anatomyTue] }))).toEqual([]);
  });
});

describe("one hour before an exact due time", () => {
  it("fires inside the last hour only, once", () => {
    expect(planNotifications(base({ now: at("2026-11-17", 13, 50), tasks: [quizTue3pm] })).map((n) => n.kind)).toEqual([]);
    const [n] = planNotifications(base({ now: at("2026-11-17", 14, 5), tasks: [quizTue3pm] }));
    expect(n).toMatchObject({ kind: "due:q", title: "Due at 3:00 PM", body: "College Algebra: Quiz" });
    expect(planNotifications(base({ now: at("2026-11-17", 14, 20), tasks: [quizTue3pm], alreadySent: new Set(["due:q"]) }))).toEqual([]);
  });
});
