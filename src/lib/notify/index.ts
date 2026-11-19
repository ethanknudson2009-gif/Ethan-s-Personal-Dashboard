/**
 * Which reminders to send right now (pure logic, tested).
 *
 *  - Morning summary (default 7:00 AM): what's due today and tomorrow, how
 *    much is overdue, and anything waiting in the Inbox. Example from Ethan:
 *    "If I have an assignment due Wednesday and it's Tuesday, remind me
 *    Tuesday morning."
 *  - Evening preview (default 8:00 PM): what's due tomorrow.
 *  - Per task, by its nag level:
 *      off        → only in the morning/evening summaries
 *      gentle     → also 1 hour before an exact due time (the default)
 *      persistent → 1 hour before, at the due time, and every 3 hours
 *                   (9 AM–9 PM) while it's overdue, for up to 3 days
 *  - Snooze: a snoozed task stays quiet until its snooze time, then gets
 *    one "⏰" reminder. Tapping any task reminder opens the snooze bar.
 *
 * Each kind is sent at most once per day (the server checks a sent-log).
 */
import { addDays, fromLocal, toLocalDate, zonedParts, type LocalTime } from "@/lib/time";
import { formatClock, taskDisplayTitle } from "@/lib/format";

export type NagLevel = "off" | "gentle" | "persistent";

export type NotifyTask = {
  id: string;
  title: string;
  className: string | null;
  dueAt: Date;
  dueHasTime: boolean;
  nagLevel?: NagLevel;
  snoozedUntil?: Date | null;
};

export type Notification = {
  kind: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Set for reminders about one task: the phone can offer Snooze / Done buttons. */
  taskId?: string;
};

export type SnoozePreset = "15m" | "1h" | "3h" | "tonight" | "tomorrow";

/**
 * When a snooze ends. "tonight" = 8 PM (or an hour from now if it's later);
 * "tomorrow" = your morning reminder time tomorrow.
 */
export function snoozeUntil(preset: SnoozePreset, now: Date, timeZone: string, morningAt: LocalTime = { hour: 7, minute: 0 }): Date {
  const minutes = (n: number) => new Date(now.getTime() + n * 60_000);
  if (preset === "15m") return minutes(15);
  if (preset === "1h") return minutes(60);
  if (preset === "3h") return minutes(180);
  const today = toLocalDate(now, timeZone);
  if (preset === "tonight") {
    const eight = fromLocal(today, { hour: 20, minute: 0 }, timeZone);
    return eight.getTime() - now.getTime() > 30 * 60_000 ? eight : minutes(60);
  }
  return fromLocal(addDays(today, 1), morningAt, timeZone);
}

/** What a reminder about one task links to: Today with the snooze bar open. */
const taskUrl = (id: string) => `/today?task=${id}`;

export type PlanInput = {
  now: Date;
  timeZone: string;
  tasks: NotifyTask[]; // open tasks with a due date
  inboxCount: number;
  alreadySent: Set<string>; // kinds sent today
  /** Names of habits not checked in yet today (for the evening nudge). */
  habitsLeft?: string[];
  morningAt: LocalTime;
  eveningAt: LocalTime;
};

const minutesOf = (t: LocalTime) => t.hour * 60 + t.minute;

/** "Speech: Outline, Human Anatomy: Lab report +2 more" */
function list(tasks: NotifyTask[], max = 2): string {
  const names = tasks.slice(0, max).map((t) => taskDisplayTitle(t.title, t.className));
  return tasks.length > max ? `${names.join(", ")} +${tasks.length - max} more` : names.join(", ");
}

export function planNotifications(input: PlanInput): Notification[] {
  const { now, timeZone, tasks } = input;
  const today = toLocalDate(now, timeZone);
  const tomorrow = addDays(today, 1);
  const p = zonedParts(now, timeZone);
  const nowMin = p.hour * 60 + p.minute;
  const out: Notification[] = [];

  const dayOf = (t: NotifyTask) => toLocalDate(t.dueAt, timeZone);
  const overdue = tasks.filter((t) => t.dueAt.getTime() < now.getTime());
  const dueToday = tasks.filter((t) => dayOf(t) === today && t.dueAt.getTime() >= now.getTime());
  const dueTomorrow = tasks.filter((t) => dayOf(t) === tomorrow);

  // Morning summary: from the chosen time until noon (so a late phone still gets it).
  if (!input.alreadySent.has("morning") && nowMin >= minutesOf(input.morningAt) && nowMin < 12 * 60) {
    const lines: string[] = [];
    if (dueToday.length) lines.push(`Today: ${list(dueToday)}`);
    if (dueTomorrow.length) lines.push(`Tomorrow: ${list(dueTomorrow)}`);
    if (overdue.length) lines.push(`${overdue.length} overdue`);
    if (input.inboxCount) lines.push(`${input.inboxCount} in your Inbox to review`);
    if (lines.length) {
      const count = dueToday.length + dueTomorrow.length;
      out.push({
        kind: "morning",
        title: count ? `Good morning: ${count} due today & tomorrow` : "Good morning",
        body: lines.join("\n"),
        url: "/today",
        tag: "morning",
      });
    }
  }

  // Evening preview: from the chosen time until 11 PM. What's due tomorrow,
  // plus habits not done yet today.
  const habitsLeft = input.habitsLeft ?? [];
  if (!input.alreadySent.has("evening") && nowMin >= minutesOf(input.eveningAt) && nowMin < 23 * 60 && (dueTomorrow.length || habitsLeft.length)) {
    const lines: string[] = [];
    if (dueTomorrow.length) lines.push(list(dueTomorrow, 3));
    if (habitsLeft.length) lines.push(`Habits left today: ${habitsLeft.slice(0, 3).join(", ")}${habitsLeft.length > 3 ? ` +${habitsLeft.length - 3}` : ""}`);
    out.push({
      kind: "evening",
      title: dueTomorrow.length ? `Due tomorrow (${dueTomorrow.length})` : "Still time today",
      body: lines.filter(Boolean).join("\n"),
      url: dueTomorrow.length ? "/today" : "/life",
      tag: "evening",
    });
  }

  // Per-task reminders, by nag level and snooze.
  for (const t of tasks) {
    const name = taskDisplayTitle(t.title, t.className);
    const level = t.nagLevel ?? "gentle";
    const send = (kind: string, title: string) => {
      if (!input.alreadySent.has(kind)) out.push({ kind, title, body: name, url: taskUrl(t.id), tag: `task:${t.id}`, taskId: t.id });
    };

    // Snoozed: quiet until the snooze ends, then one reminder (within the hour after).
    if (t.snoozedUntil) {
      const past = now.getTime() - t.snoozedUntil.getTime();
      if (past < 0) continue;
      if (past < 60 * 60_000) {
        send(`snooze:${t.id}:${t.snoozedUntil.toISOString().slice(0, 16)}`, "⏰ Snoozed reminder");
        continue;
      }
    }
    if (level === "off") continue;

    const minutesLeft = (t.dueAt.getTime() - now.getTime()) / 60_000;
    const d = zonedParts(t.dueAt, timeZone);
    // One hour before an exact due time (gentle and persistent).
    if (t.dueHasTime && minutesLeft > 0 && minutesLeft <= 60) send(`due:${t.id}`, `Due at ${formatClock(d.hour, d.minute)}`);
    if (level !== "persistent") continue;
    // Persistent: at the due time…
    if (t.dueHasTime && minutesLeft <= 0 && minutesLeft > -15) send(`due-now:${t.id}`, "⏰ Due now");
    // …and every 3 hours, 9 AM–9 PM, while overdue (up to 3 days).
    const hoursLate = -minutesLeft / 60;
    if (minutesLeft < 0 && hoursLate <= 72 && p.hour >= 9 && p.hour < 21 && hoursLate >= (t.dueHasTime ? 0.25 : 0)) {
      send(`nag:${t.id}:${Math.floor((p.hour - 9) / 3)}`, `Still not done (${hoursLate < 24 ? "overdue" : `${Math.floor(hoursLate / 24)}d overdue`})`);
    }
  }
  return out;
}
