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

/** Voice/quick add: "did my reading" → check in the habit named "Reading" for today. */
export async function checkInHabitByNameAction(name: string): Promise<Result & { habit?: string; already?: boolean }> {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const { data: habits } = await supabase.from("habits").select("id, name, emoji").is("deleted_at", null).eq("archived", false);
  const habit = (habits ?? []).find((h) => h.name.toLowerCase() === name.trim().toLowerCase());
  if (!habit) return { ok: false, error: `No habit called "${name}"` };
  const today = toLocalDate(new Date(), timeZone);
  const { data: existing } = await supabase.from("habit_checkins").select("id").eq("habit_id", habit.id).eq("on_date", today).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from("habit_checkins").insert({ habit_id: habit.id, on_date: today });
    if (error) return { ok: false, error: error.message };
  }
  refresh();
  return { ok: true, habit: `${habit.emoji ? `${habit.emoji} ` : ""}${habit.name}`, already: Boolean(existing) };
}

/**
 * Voice/quick add: a journal line ("I feel great today", "note: …") is added
 * to today's entry on a new line. A mood heard in it fills today's mood if
 * you haven't picked one yet.
 */
export async function addToJournalAction(text: string, mood: number | null): Promise<Result> {
  const line = text.trim().slice(0, 4000);
  if (!line) return { ok: false, error: "Nothing to save" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { timeZone } = await loadSettings(supabase);
  const today = toLocalDate(new Date(), timeZone);
  const { data: entry } = await supabase.from("journal_entries").select("mood, body").eq("on_date", today).maybeSingle();
  const body = entry?.body ? `${entry.body.trimEnd()}\n${line}` : line;
  const keepMood = entry?.mood ?? (mood !== null && mood >= 1 && mood <= 5 ? mood : null);
  const { error } = await supabase
    .from("journal_entries")
    .upsert({ user_id: user.id, on_date: today, mood: keepMood, body: body.slice(0, 10000) }, { onConflict: "user_id,on_date" });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const foodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calories: z.number().int().min(0).max(10000).nullable(),
  proteinG: z.number().int().min(0).max(1000).nullable(),
});

/** Logs something you ate today ("chicken burrito 700 calories"). */
export async function logFoodAction(input: z.input<typeof foodSchema>): Promise<Result> {
  const p = foodSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Say what you ate" };
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const { error } = await supabase.from("food_entries").insert({
    on_date: toLocalDate(new Date(), timeZone),
    name: p.data.name,
    calories: p.data.calories,
    protein_g: p.data.proteinG,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteFoodAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("food_entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Daily calorie goal (empty = no goal). */
export async function setCalorieGoalAction(goal: number | null): Promise<Result> {
  if (goal !== null && !(Number.isInteger(goal) && goal >= 500 && goal <= 10000)) return { ok: false, error: "Pick a goal between 500 and 10,000" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await supabase.from("profiles").update({ calorie_goal: goal }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
