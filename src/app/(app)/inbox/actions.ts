"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { moneyRowFromDraft, readDraft, SAVEABLE_TYPES, taskRowFromDraft } from "@/lib/capture";
import { toLocalDate } from "@/lib/time";
import type { ActionResult } from "@/app/(app)/tasks/actions";
import { parse } from "@/lib/parser";
import { checkInHabitByNameAction, logFoodAction } from "@/app/(app)/life/actions";
import { logCardioAction, logQuickSetsAction } from "@/app/(app)/gym/actions";

/*
 * Inbox actions: approve (turn the draft into a real task), dismiss, and
 * restore things from the Trash. All run as the logged-in user (RLS).
 */

async function approveOne(supabase: Awaited<ReturnType<typeof createClient>>, id: string, timeZone: string): Promise<ActionResult> {
  const { data: item, error } = await supabase
    .from("inbox_items")
    .select("id, draft, source, status, raw_text")
    .eq("id", id)
    .single();
  if (error || !item) return { ok: false, error: "Couldn't find that Inbox item" };
  if (item.status !== "pending") return { ok: true };

  const draft = readDraft(item.draft);
  if (!draft) return { ok: false, error: "This item can't be read. Dismiss it and add it again." };
  if (!SAVEABLE_TYPES.includes(draft.type)) {
    // Food, workouts and habits: read the words again and log them where they belong.
    const logged = await logOther(supabase, item.raw_text || draft.title, timeZone);
    if (!logged.ok) return logged;
    const { error: e3 } = await supabase.from("inbox_items").update({ status: "approved", result_table: logged.table, result_id: null }).eq("id", id);
    if (e3) return { ok: false, error: e3.message };
    return { ok: true };
  }

  let saved: { id: string } | null = null;
  let table: "tasks" | "money_transactions" = "tasks";
  if (draft.type === "expense") {
    if (draft.amount == null) return { ok: false, error: "How much was it? Tap Edit to add the amount." };
    table = "money_transactions";
    const { data, error: e1 } = await supabase.from("money_transactions").insert(moneyRowFromDraft(draft, toLocalDate(new Date(), timeZone))).select("id").single();
    if (e1 || !data) return { ok: false, error: e1?.message ?? "Couldn't save" };
    saved = data;
  } else {
    const { data, error: e1 } = await supabase.from("tasks").insert(taskRowFromDraft(draft, timeZone, item.source)).select("id").single();
    if (e1 || !data) return { ok: false, error: e1?.message ?? "Couldn't save" };
    saved = data;
  }

  const { error: e2 } = await supabase
    .from("inbox_items")
    .update({ status: "approved", result_table: table, result_id: saved.id })
    .eq("id", id);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true };
}

/** Logs a food / workout / habit line from the Inbox, the same way the + sheet does. */
async function logOther(
  supabase: Awaited<ReturnType<typeof createClient>>,
  text: string,
  timeZone: string,
): Promise<{ ok: true; table: string } | { ok: false; error: string }> {
  const { data: habits } = await supabase.from("habits").select("name").is("deleted_at", null).eq("archived", false);
  const d = parse(text, { now: new Date(), timeZone, habits: (habits ?? []).map((h) => h.name), spoken: true });
  const done = (r: { ok: boolean; error?: string }, table: string) => (r.ok ? { ok: true as const, table } : { ok: false as const, error: r.error ?? "Couldn't save" });
  switch (d.type) {
    case "food":
      return done(await logFoodAction({ name: d.title, calories: d.calories, proteinG: d.proteinG }), "food_entries");
    case "workout":
      if (d.sets) return done(await logQuickSetsAction({ said: d.title, ...d.sets }), "workout_sets");
      return done(await logCardioAction({ name: d.title, miles: d.distanceMiles, minutes: d.minutes }), "workouts");
    case "habit":
      if (!d.habitName) return { ok: false, error: "Which habit? Add it in Life first, or dismiss this." };
      return done(await checkInHabitByNameAction(d.habitName), "habit_checkins");
    default:
      return { ok: false, error: "Tap Edit to save this as a task." };
  }
}

export async function approveInboxAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const result = await approveOne(supabase, id, timeZone);
  refresh();
  return result;
}

/** Approves every pending item that has no problems and can be saved (optionally only one batch). */
export async function approveAllCleanAction(batchId?: string): Promise<ActionResult & { count?: number }> {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  let query = supabase
    .from("inbox_items")
    .select("id, type, problems")
    .eq("status", "pending")
    .is("deleted_at", null);
  if (batchId) query = query.eq("batch_id", batchId);
  const { data: items, error } = await query;
  if (error) return { ok: false, error: error.message };

  let count = 0;
  for (const item of items ?? []) {
    if (item.problems.length > 0 || !SAVEABLE_TYPES.includes(item.type as never)) continue;
    const r = await approveOne(supabase, item.id, timeZone);
    if (r.ok) count++;
  }
  refresh();
  return { ok: true, count };
}

export async function dismissInboxAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("inbox_items").update({ status: "dismissed" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Brings something back from the Trash. */
export async function restoreAction(kind: "task" | "class" | "habit", id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const table = kind === "task" ? "tasks" : kind === "class" ? "classes" : "habits";
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
