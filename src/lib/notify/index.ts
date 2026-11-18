/**
 * Which reminders to send right now (pure logic, tested).
 *
 *  - Morning summary (default 7:00 AM): what's due today and tomorrow, how
 *    much is overdue, and anything waiting in the Inbox. Example from Ethan:
 *    "If I have an assignment due Wednesday and it's Tuesday, remind me
 *    Tuesday morning."
 *  - Evening preview (default 8:00 PM): what's due tomorrow.
 *  - One hour before anything with an exact due time.
 *
 * Each kind is sent at most once per day (the server checks a sent-log).
 */
import { addDays, toLocalDate, zonedParts, type LocalTime } from "@/lib/time";
import { formatClock, taskDisplayTitle } from "@/lib/format";

export type NotifyTask = { id: string; title: string; className: string | null; dueAt: Date; dueHasTime: boolean };

export type Notification = { kind: string; title: string; body: string; url: string; tag: string };

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

  // One hour before an exact due time.
  for (const t of tasks) {
    if (!t.dueHasTime) continue;
    const minutesLeft = (t.dueAt.getTime() - now.getTime()) / 60_000;
    const kind = `due:${t.id}`;
    if (minutesLeft > 0 && minutesLeft <= 60 && !input.alreadySent.has(kind)) {
      const d = zonedParts(t.dueAt, timeZone);
      out.push({
        kind,
        title: `Due at ${formatClock(d.hour, d.minute)}`,
        body: taskDisplayTitle(t.title, t.className),
        url: "/today",
        tag: kind,
      });
    }
  }
  return out;
}
