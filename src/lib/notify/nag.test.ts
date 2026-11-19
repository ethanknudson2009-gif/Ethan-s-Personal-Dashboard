import { describe, expect, it } from "vitest";
import { fromLocal } from "@/lib/time";
import { planNotifications, snoozeUntil, type NotifyTask, type PlanInput } from "./index";

const PHX = "America/Phoenix";
const at = (date: string, hour: number, minute = 0) => fromLocal(date, { hour, minute }, PHX);

// A quiz due Tuesday at 3 PM.
const quiz = (o: Partial<NotifyTask> = {}): NotifyTask => ({ id: "q", title: "Quiz", className: "College Algebra", dueAt: at("2026-11-17", 15), dueHasTime: true, ...o });
const plan = (now: Date, task: NotifyTask, sent: string[] = []) =>
  planNotifications({
    now,
    timeZone: PHX,
    tasks: [task],
    inboxCount: 0,
    alreadySent: new Set(sent),
    morningAt: { hour: 7, minute: 0 },
    eveningAt: { hour: 20, minute: 0 },
  } satisfies PlanInput).filter((n) => n.taskId);
const kinds = (now: Date, task: NotifyTask, sent: string[] = []) => plan(now, task, sent).map((n) => n.kind);

describe("nag levels", () => {
  it("gentle (default): one hour before, and nothing once it's overdue", () => {
    expect(kinds(at("2026-11-17", 14, 15), quiz())).toEqual(["due:q"]);
    expect(kinds(at("2026-11-17", 15, 5), quiz())).toEqual([]);
    expect(kinds(at("2026-11-17", 18), quiz())).toEqual([]);
  });

  it("off: no task reminders at all", () => {
    expect(kinds(at("2026-11-17", 14, 15), quiz({ nagLevel: "off" }))).toEqual([]);
    expect(kinds(at("2026-11-17", 18), quiz({ nagLevel: "off" }))).toEqual([]);
  });

  it("persistent: an hour before, at the time, then every 3 hours 9 AM–9 PM while overdue", () => {
    const t = quiz({ nagLevel: "persistent" });
    expect(kinds(at("2026-11-17", 14, 15), t)).toEqual(["due:q"]);
    expect(kinds(at("2026-11-17", 15, 5), t)).toEqual(["due-now:q"]);
    expect(kinds(at("2026-11-17", 15, 30), t)).toEqual(["nag:q:2"]);
    expect(kinds(at("2026-11-17", 15, 45), t, ["nag:q:2"])).toEqual([]); // not twice in the same slot
    expect(kinds(at("2026-11-17", 18, 0), t, ["nag:q:2"])).toEqual(["nag:q:3"]);
    expect(kinds(at("2026-11-17", 22, 0), t)).toEqual([]); // quiet at night
    expect(kinds(at("2026-11-18", 9, 15), t)).toEqual(["nag:q:0"]); // next morning
    expect(plan(at("2026-11-18", 9, 15), t)[0].title).toBe("Still not done (overdue)");
    expect(plan(at("2026-11-19", 16, 0), t)[0].title).toBe("Still not done (2d overdue)");
    expect(kinds(at("2026-11-21", 12, 0), t)).toEqual([]); // gives up after 3 days
  });

  it("reminders link to the task's snooze bar", () => {
    const n = plan(at("2026-11-17", 14, 15), quiz())[0];
    expect(n).toMatchObject({ url: "/today?task=q", taskId: "q", body: "College Algebra: Quiz" });
  });
});

describe("snooze", () => {
  it("quiet while snoozed, then one ⏰ reminder", () => {
    const t = quiz({ nagLevel: "persistent", snoozedUntil: at("2026-11-17", 16, 30) });
    expect(kinds(at("2026-11-17", 15, 5), t)).toEqual([]);
    expect(kinds(at("2026-11-17", 16, 0), t)).toEqual([]);
    const ring = plan(at("2026-11-17", 16, 32), t);
    expect(ring.map((n) => n.title)).toEqual(["⏰ Snoozed reminder"]);
    expect(kinds(at("2026-11-17", 16, 45), t, [ring[0].kind])).toEqual([]); // once
  });

  it("an old snooze no longer holds anything back", () => {
    const t = quiz({ nagLevel: "persistent", snoozedUntil: at("2026-11-17", 9, 0) });
    expect(kinds(at("2026-11-17", 15, 5), t)).toEqual(["due-now:q"]);
  });

  it("snooze times", () => {
    const now = at("2026-11-17", 15, 0);
    expect(snoozeUntil("15m", now, PHX)).toEqual(at("2026-11-17", 15, 15));
    expect(snoozeUntil("1h", now, PHX)).toEqual(at("2026-11-17", 16, 0));
    expect(snoozeUntil("tonight", now, PHX)).toEqual(at("2026-11-17", 20, 0));
    expect(snoozeUntil("tonight", at("2026-11-17", 19, 50), PHX)).toEqual(at("2026-11-17", 20, 50)); // too close to 8: an hour
    expect(snoozeUntil("tomorrow", now, PHX, { hour: 7, minute: 30 })).toEqual(at("2026-11-18", 7, 30));
  });
});
