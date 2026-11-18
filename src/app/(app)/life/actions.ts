"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { toLocalDate } from "@/lib/time";

type Result = { ok: true } | { ok: false; error: string };

const habitSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
  emoji: z.string().trim().max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  times: z.number().int().min(1).max(14),
  per: z.enum(["day", "week"]),
});

export async function createHabitAction(input: z.input<typeof habitSchema>): Promise<Result> {
  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const h = parsed.data;
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const { error } = await supabase.from("habits").insert({
    name: h.name,
    emoji: h.emoji || null,
    color: h.color,
    target_times: h.times,
    target_per: h.per,
    started_on: toLocalDate(new Date(), timeZone),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Checks a habit in for a day, or un-checks it if it already was. */
export async function toggleCheckinAction(habitId: string, date: string): Promise<Result & { checked?: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Bad date" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("habit_checkins").select("id").eq("habit_id", habitId).eq("on_date", date).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("habit_checkins").delete().eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, checked: false };
  }
  const { error } = await supabase.from("habit_checkins").insert({ habit_id: habitId, on_date: date });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, checked: true };
}

export async function deleteHabitAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("habits").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Saves today's journal entry (mood 1–5 and/or text). One entry per day. */
export async function saveJournalAction(date: string, mood: number | null, body: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Bad date" };
  if (mood !== null && !(Number.isInteger(mood) && mood >= 1 && mood <= 5)) return { ok: false, error: "Bad mood" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase
    .from("journal_entries")
    .upsert({ user_id: user.id, on_date: date, mood, body: body.slice(0, 10000) }, { onConflict: "user_id,on_date" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
