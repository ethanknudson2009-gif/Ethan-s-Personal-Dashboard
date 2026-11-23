"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { toLocalDate } from "@/lib/time";
import { tomorrowDue } from "@/lib/day-plan";

/*
 * Morning Plan and Evening Shutdown. Each runs as the logged-in user, so Row
 * Level Security keeps everything to your own rows.
 */

type Result = { ok: true } | { ok: false; error: string };

const planSchema = z.object({
  focusIds: z.array(z.string().uuid()).max(3),
  intention: z.string().trim().max(200).nullable(),
});

/** Morning: saves today's top 3 and the one-line intention. */
export async function savePlanAction(input: z.input<typeof planSchema>): Promise<Result> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick up to 3 things" };
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("day_plans").upsert(
    {
      user_id: user.id,
      on_date: toLocalDate(new Date(), timeZone),
      focus_task_ids: parsed.data.focusIds,
      intention: parsed.data.intention || null,
      planned_at: new Date().toISOString(),
    },
    { onConflict: "user_id,on_date" },
  );
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Evening: moves unfinished tasks to tomorrow (same time of day if they have one). */
export async function moveToTomorrowAction(ids: string[]): Promise<Result & { moved?: number }> {
  if (!z.array(z.string().uuid()).max(100).safeParse(ids).success) return { ok: false, error: "Bad list" };
  if (!ids.length) return { ok: true, moved: 0 };
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const { data: tasks, error } = await supabase.from("tasks").select("id, due_at, due_has_time").in("id", ids).eq("status", "open");
  if (error) return { ok: false, error: error.message };
  const now = new Date();
  for (const t of tasks ?? []) {
    const { error: e } = await supabase
      .from("tasks")
      .update({ due_at: tomorrowDue(t, now, timeZone), due_has_time: t.due_has_time && Boolean(t.due_at), snoozed_until: null })
      .eq("id", t.id);
    if (e) return { ok: false, error: e.message };
  }
  refresh();
  return { ok: true, moved: tasks?.length ?? 0 };
}

/** Evening: marks the day shut down. */
export async function finishShutdownAction(): Promise<Result> {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const today = toLocalDate(new Date(), timeZone);

  const { error } = await supabase
    .from("day_plans")
    .upsert({ user_id: user.id, on_date: today, shutdown_at: new Date().toISOString() }, { onConflict: "user_id,on_date" });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
