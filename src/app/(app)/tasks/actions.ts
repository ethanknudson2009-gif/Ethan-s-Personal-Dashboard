"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { fromLocal } from "@/lib/time";
import { nextOccurrence, repeatFromForm } from "@/lib/tasks";

/*
 * Server actions for tasks and assignments, called from the quick-add sheet
 * and task rows. Every query runs as the logged-in user, so Row Level
 * Security keeps each person to their own rows. Each action returns a
 * result instead of throwing, so the screen can show a friendly message.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Type what you need to do").max(200),
  classId: z.string().uuid().nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** Only set when typed in quick add ("fri 3pm"); there's no time field. */
  dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  repeat: z.enum(["none", "daily", "weekly", "biweekly", "monthly"]).default("none"),
  /** Set when this came from reviewing an Inbox item: marks it approved. */
  inboxId: z.string().uuid().optional(),
  /** Extra context, shown as a caption under the task. */
  notes: z.string().trim().max(2000).nullable().optional(),
  /** School, work (PRMI) or personal. A class always means school. */
  area: z.enum(["school", "work", "personal"]).optional(),
});

export type SaveTaskInput = z.input<typeof saveSchema>;

export async function saveTaskAction(input: SaveTaskInput): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const t = parsed.data;

  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);

  let dueAt: string | null = null;
  if (t.dueDate) {
    const [h, m] = (t.dueTime ?? "23:59").split(":").map(Number);
    dueAt = fromLocal(t.dueDate, { hour: h, minute: m }, timeZone).toISOString();
  }
  const repeat = repeatFromForm(t.repeat);
  if (repeat && !dueAt) return { ok: false, error: "Pick a day so it knows when to repeat" };

  const row = {
    title: t.title,
    class_id: t.classId,
    kind: t.classId ? ("assignment" as const) : ("task" as const),
    due_at: dueAt,
    due_has_time: Boolean(t.dueDate && t.dueTime),
    repeat,
    area: t.classId ? ("school" as const) : (t.area ?? "personal"),
    ...(t.notes !== undefined ? { notes: t.notes || null } : {}),
  };

  if (t.id) {
    const { error } = await supabase.from("tasks").update(row).eq("id", t.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...row, source: t.inboxId ? "inbox" : "quick_add" })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save" };
    if (t.inboxId) {
      await supabase
        .from("inbox_items")
        .update({ status: "approved", result_table: "tasks", result_id: data.id })
        .eq("id", t.inboxId);
    }
  }
  refresh();
  return { ok: true };
}

/** Check a task off. If it repeats, the next copy is created right away. */
export async function completeTaskAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, kind, class_id, notes, due_at, due_has_time, estimate_minutes, priority, repeat, series_id, nag_level, source, status")
    .eq("id", id)
    .single();
  if (error || !task) return { ok: false, error: "Couldn't find that task" };
  if (task.status === "done") return { ok: true };

  const now = new Date();
  const seriesId = task.series_id ?? task.id;
  const { error: e1 } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: now.toISOString(), series_id: task.repeat ? seriesId : task.series_id })
    .eq("id", id);
  if (e1) return { ok: false, error: e1.message };

  const { timeZone } = await loadSettings(supabase);
  const next = nextOccurrence(task, now, timeZone);
  if (next) {
    const { error: e2 } = await supabase.from("tasks").insert({
      title: task.title,
      kind: task.kind,
      class_id: task.class_id,
      notes: task.notes,
      due_at: next.toISOString(),
      due_has_time: task.due_has_time,
      estimate_minutes: task.estimate_minutes,
      priority: task.priority,
      repeat: task.repeat,
      series_id: seriesId,
      nag_level: task.nag_level,
      source: task.source,
    });
    if (e2) return { ok: false, error: e2.message };
  }
  refresh();
  return { ok: true };
}

/** Undo a check-off. (A repeat copy that was already created stays.) */
export async function reopenTaskAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status: "open", completed_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Moves a task to the Trash (restorable for 7 days). */
export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Adds focused minutes to a task (from the focus timer). */
export async function logFocusAction(id: string, minutes: number): Promise<ActionResult> {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) return { ok: false, error: "Invalid minutes" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("minutes_done").eq("id", id).single();
  if (error || !data) return { ok: false, error: "Couldn't find that task" };
  const { error: e2 } = await supabase.from("tasks").update({ minutes_done: data.minutes_done + minutes }).eq("id", id);
  if (e2) return { ok: false, error: e2.message };
  refresh();
  return { ok: true };
}
