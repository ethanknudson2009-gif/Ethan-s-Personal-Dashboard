"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { failTo } from "@/lib/form-errors";
import { loadSettings } from "@/lib/profile";
import { fromLocal } from "@/lib/time";
import { nextOccurrence, repeatFromForm } from "@/lib/tasks";

/*
 * Server actions for tasks and assignments. Every query runs as the
 * logged-in user, so Row Level Security keeps each person to their own rows.
 * `back` is the page to return to on an error (Tasks or Today).
 */

function backPath(formData: FormData): string {
  const back = String(formData.get("back") ?? "/tasks");
  return back.startsWith("/") && !back.startsWith("//") ? back : "/tasks";
}

const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Give it a title").max(200),
  kind: z.enum(["task", "assignment", "exam", "project"]),
  class_id: z.string().optional(),
  due_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
  due_time: z.string().regex(/^(\d{2}:\d{2})?$/).optional(),
  estimate_minutes: z.string().regex(/^\d*$/, "Estimate must be whole minutes").optional(),
  priority: z.enum(["1", "2", "3"]).optional(),
  notes: z.string().max(2000).optional(),
  repeat_preset: z.string().optional(),
  repeat_after_days: z.string().optional(),
});

export async function saveTask(formData: FormData) {
  const back = backPath(formData);
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) failTo(back, parsed.error.issues[0].message);
  const t = parsed.data;

  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);

  // Due date + optional time → one instant. No time means "end of that day".
  let dueAt: string | null = null;
  const hasTime = Boolean(t.due_date && t.due_time);
  if (t.due_date) {
    const [h, m] = (t.due_time || "23:59").split(":").map(Number);
    dueAt = fromLocal(t.due_date, { hour: h, minute: m }, timeZone).toISOString();
  } else if (t.due_time) {
    failTo(back, "Pick a date to go with the time");
  }

  const repeat = repeatFromForm(t.repeat_preset ?? "none", Number(t.repeat_after_days));
  if (repeat && !dueAt) failTo(back, "A repeating task needs a due date to repeat from");

  const classId = t.class_id || null;
  const row = {
    title: t.title,
    // Anything tied to a class is school work, even if "task" was left selected.
    kind: classId && t.kind === "task" ? ("assignment" as const) : t.kind,
    class_id: classId,
    due_at: dueAt,
    due_has_time: hasTime,
    estimate_minutes: t.estimate_minutes ? Number(t.estimate_minutes) : null,
    priority: Number(t.priority ?? "2"),
    notes: t.notes?.trim() || null,
    repeat,
  };

  const { error } = t.id
    ? await supabase.from("tasks").update(row).eq("id", t.id)
    : await supabase.from("tasks").insert({ ...row, source: "manual" });
  if (error) failTo(back, error.message);
  refresh();
}

/** Check a task off. If it repeats, the next copy is created right away. */
export async function completeTask(formData: FormData) {
  const back = backPath(formData);
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, kind, class_id, notes, due_at, due_has_time, estimate_minutes, priority, repeat, series_id, nag_level, source, status")
    .eq("id", id)
    .single();
  if (error || !task) failTo(back, "Couldn't find that task");
  if (task.status === "done") return refresh();

  const now = new Date();
  const seriesId = task.series_id ?? task.id;
  const { error: e1 } = await supabase
    .from("tasks")
    .update({ status: "done", completed_at: now.toISOString(), series_id: task.repeat ? seriesId : task.series_id })
    .eq("id", id);
  if (e1) failTo(back, e1.message);

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
    if (e2) failTo(back, e2.message);
  }
  refresh();
}

/** Undo a check-off. (A repeat copy that was already created stays.) */
export async function reopenTask(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status: "open", completed_at: null })
    .eq("id", String(formData.get("id")));
  if (error) failTo(backPath(formData), error.message);
  refresh();
}

/** "+30 m": record study time already spent, so the Cushion updates. */
export async function logMinutes(formData: FormData) {
  const back = backPath(formData);
  const minutes = Number(formData.get("minutes"));
  if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > 600) failTo(back, "Invalid minutes");
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { data, error } = await supabase.from("tasks").select("minutes_done").eq("id", id).single();
  if (error || !data) failTo(back, "Couldn't find that task");
  const { error: e2 } = await supabase
    .from("tasks")
    .update({ minutes_done: Math.max(0, data.minutes_done + minutes) })
    .eq("id", id);
  if (e2) failTo(back, e2.message);
  refresh();
}

/** Moves a task to the Trash (restorable for 7 days). */
export async function deleteTask(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));
  if (error) failTo(backPath(formData), error.message);
  refresh();
}
