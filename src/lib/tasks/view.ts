/**
 * Turns a task row from the database into what the screen shows: the
 * class-first title, the due text, and how strongly to highlight it.
 */
import { formatDue, daysUntil, taskDisplayTitle } from "@/lib/format";
import { toLocalDate, zonedParts } from "@/lib/time";
import { describeRepeat, parseRepeat, presetFromRule } from "./index";

/** How urgent a task looks: overdue glows red, today glows teal and pulses, tomorrow gets amber. */
export type Tone = "overdue" | "today" | "tomorrow" | "normal" | "done";

export type TaskRecord = {
  id: string;
  title: string;
  class_id: string | null;
  due_at: string | null;
  due_has_time: boolean;
  status: string;
  repeat: unknown;
};

export type TaskView = {
  id: string;
  displayTitle: string;
  classColor: string | null;
  dueText: string | null;
  tone: Tone;
  repeatText: string | null;
  done: boolean;
  edit: {
    id: string;
    title: string;
    classId: string | null;
    dueDate: string | null;
    dueTime: string | null;
    repeat: "none" | "daily" | "weekly" | "biweekly" | "monthly";
  };
};

export function toneFor(task: Pick<TaskRecord, "due_at" | "status">, now: Date, timeZone: string): Tone {
  if (task.status === "done") return "done";
  if (!task.due_at) return "normal";
  const due = new Date(task.due_at);
  if (due.getTime() < now.getTime()) return "overdue";
  const days = daysUntil(due, now, timeZone);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return "normal";
}

export function toTaskView(
  task: TaskRecord,
  cls: { name: string; color: string } | null,
  now: Date,
  timeZone: string,
): TaskView {
  const due = task.due_at ? new Date(task.due_at) : null;
  const rule = parseRepeat(task.repeat);
  const { preset } = presetFromRule(rule);
  let dueTime: string | null = null;
  if (due && task.due_has_time) {
    const p = zonedParts(due, timeZone);
    dueTime = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  }
  return {
    id: task.id,
    displayTitle: taskDisplayTitle(task.title, cls?.name ?? null),
    classColor: cls?.color ?? null,
    dueText: due ? formatDue(due, task.due_has_time, now, timeZone) : null,
    tone: toneFor(task, now, timeZone),
    repeatText: describeRepeat(rule),
    done: task.status === "done",
    edit: {
      id: task.id,
      title: task.title,
      classId: task.class_id,
      dueDate: due ? toLocalDate(due, timeZone) : null,
      dueTime,
      repeat: preset === "after_days" ? "none" : preset,
    },
  };
}
