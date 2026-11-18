"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { readDraft, SAVEABLE_TYPES, taskRowFromDraft } from "@/lib/capture";
import type { ActionResult } from "@/app/(app)/tasks/actions";

/*
 * Inbox actions: approve (turn the draft into a real task), dismiss, and
 * restore things from the Trash. All run as the logged-in user (RLS).
 */

async function approveOne(supabase: Awaited<ReturnType<typeof createClient>>, id: string, timeZone: string): Promise<ActionResult> {
  const { data: item, error } = await supabase
    .from("inbox_items")
    .select("id, draft, source, status")
    .eq("id", id)
    .single();
  if (error || !item) return { ok: false, error: "Couldn't find that Inbox item" };
  if (item.status !== "pending") return { ok: true };

  const draft = readDraft(item.draft);
  if (!draft) return { ok: false, error: "This item can't be read. Dismiss it and add it again." };
  if (!SAVEABLE_TYPES.includes(draft.type)) return { ok: false, error: `${draft.type} tracking isn't built yet` };

  const { data: task, error: e1 } = await supabase
    .from("tasks")
    .insert(taskRowFromDraft(draft, timeZone, item.source))
    .select("id")
    .single();
  if (e1 || !task) return { ok: false, error: e1?.message ?? "Couldn't save" };

  const { error: e2 } = await supabase
    .from("inbox_items")
    .update({ status: "approved", result_table: "tasks", result_id: task.id })
    .eq("id", id);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true };
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
export async function restoreAction(kind: "task" | "class", id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const table = kind === "task" ? "tasks" : "classes";
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
