"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { toLocalDate } from "@/lib/time";
import { lastTime, matchExercise, newRecords, nextAfter, volume, type GymSet } from "@/lib/gym";
import { DEFAULT_SPLIT, dayForMuscles, muscleOf, readWorkout, workoutNote } from "@/lib/gym-speech";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Starts a workout, or returns the one you already have going. */
export async function startWorkoutAction(): Promise<Result<{ id: string }>> {
  const supabase = await createClient();
  const { data: open } = await supabase.from("workouts").select("id").is("ended_at", null).is("deleted_at", null).maybeSingle();
  if (open) return { ok: true, id: open.id };
  const { data, error } = await supabase.from("workouts").insert({}).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't start" };
  refresh();
  return { ok: true, id: data.id };
}

/** Adds an exercise to the workout, pre-filled with what you did last time (or 3 empty sets). */
export async function addExerciseAction(workoutId: string, exerciseId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("workouts")
    .select("id, workout_sets(exercise_id, weight_lb, reps, done)")
    .not("ended_at", "is", null)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(20);
  const history: GymSet[][] = (recent ?? []).map((w) =>
    (w.workout_sets ?? []).map((s) => ({ exerciseId: s.exercise_id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps, done: s.done })),
  );
  const prev = lastTime(exerciseId, history);
  const { count } = await supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", workoutId);
  const base = count ?? 0;
  const rows = (prev.length ? prev : [{ weightLb: null, reps: null }, { weightLb: null, reps: null }, { weightLb: null, reps: null }]).map((s, i) => ({
    workout_id: workoutId,
    exercise_id: exerciseId,
    position: base + i,
    weight_lb: s.weightLb,
    reps: s.reps,
    done: false,
  }));
  const { error } = await supabase.from("workout_sets").insert(rows);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function addSetAction(workoutId: string, exerciseId: string, weightLb: number | null, reps: number | null): Promise<Result> {
  const supabase = await createClient();
  const { count } = await supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", workoutId);
  const { error } = await supabase
    .from("workout_sets")
    .insert({ workout_id: workoutId, exercise_id: exerciseId, position: count ?? 0, weight_lb: weightLb, reps, done: false });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const setPatch = z.object({
  weightLb: z.number().min(0).max(2000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  done: z.boolean().optional(),
});

export async function updateSetAction(id: string, patch: z.input<typeof setPatch>): Promise<Result> {
  const p = setPatch.safeParse(patch);
  if (!p.success) return { ok: false, error: "Check the weight and reps" };
  const supabase = await createClient();
  const row: { weight_lb?: number | null; reps?: number | null; done?: boolean } = {};
  if (p.data.weightLb !== undefined) row.weight_lb = p.data.weightLb;
  if (p.data.reps !== undefined) row.reps = p.data.reps;
  if (p.data.done !== undefined) row.done = p.data.done;
  const { error } = await supabase.from("workout_sets").update(row).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteSetAction(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("workout_sets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Finishes the workout: keeps finished sets, works out new personal
 * records, and checks in a "Gym"/"Workout"/"Lift" habit if you have one.
 */
export async function finishWorkoutAction(workoutId: string): Promise<Result<{ volume: number; records: { name: string; e1rm: number; previous: number }[]; sets: number }>> {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  await supabase.from("workout_sets").delete().eq("workout_id", workoutId).eq("done", false);
  const [{ data: todaySets }, { data: history }, { data: exercises }] = await Promise.all([
    supabase.from("workout_sets").select("exercise_id, weight_lb, reps, done").eq("workout_id", workoutId),
    supabase
      .from("workouts")
      .select("workout_sets(exercise_id, weight_lb, reps, done)")
      .neq("id", workoutId)
      .not("ended_at", "is", null)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(100),
    supabase.from("exercises").select("id, name"),
  ]);
  const toSet = (s: { exercise_id: string; weight_lb: number | null; reps: number | null; done: boolean }): GymSet => ({
    exerciseId: s.exercise_id,
    weightLb: s.weight_lb === null ? null : Number(s.weight_lb),
    reps: s.reps,
    done: s.done,
  });
  const today = (todaySets ?? []).map(toSet);
  if (!today.length) {
    await supabase.from("workouts").delete().eq("id", workoutId);
    refresh();
    return { ok: false, error: "No finished sets, so nothing was saved" };
  }
  const past = (history ?? []).flatMap((w) => (w.workout_sets ?? []).map(toSet));
  const names = new Map((exercises ?? []).map((e) => [e.id, e.name]));
  const records = newRecords(today, past).map((r) => ({ name: names.get(r.exerciseId) ?? "Exercise", e1rm: r.e1rm, previous: r.previous }));

  // Which muscles and split day this was, from the exercises done.
  const { data: exInfo } = await supabase.from("exercises").select("id, name, muscle").in("id", [...new Set(today.map((t) => t.exerciseId))]);
  const muscles = [...new Set((exInfo ?? []).map((e) => muscleOf(e)).filter((m) => m !== "other" && m !== "core"))];
  const { data: me } = await supabase.from("profiles").select("gym_split").maybeSingle();
  const { data: thisWorkout } = await supabase.from("workouts").select("split_day").eq("id", workoutId).maybeSingle();
  const day = thisWorkout?.split_day ?? dayForMuscles(muscles, me?.gym_split?.length ? me.gym_split : DEFAULT_SPLIT);
  await supabase.from("workouts").update({ ended_at: new Date().toISOString(), muscles, split_day: day }).eq("id", workoutId);
  await advanceAfter(supabase, day);

  // Count it for a gym habit, if there is one.
  const { data: habits } = await supabase.from("habits").select("id, name").is("deleted_at", null).eq("archived", false);
  const gymHabit = (habits ?? []).find((h) => /\b(gym|workout|work out|lift|lifting|exercise|train)/i.test(h.name));
  if (gymHabit) {
    await supabase
      .from("habit_checkins")
      .upsert({ habit_id: gymHabit.id, on_date: toLocalDate(new Date(), timeZone) }, { onConflict: "habit_id,on_date", ignoreDuplicates: true });
  }
  refresh();
  return { ok: true, volume: volume(today), records, sets: today.length };
}

export async function discardWorkoutAction(workoutId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function createExerciseAction(name: string, muscle: string): Promise<Result<{ id: string }>> {
  const n = name.trim();
  if (!n || n.length > 60) return { ok: false, error: "Name the exercise" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data, error } = await supabase.from("exercises").insert({ user_id: user.id, name: n, muscle: muscle || "other" }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add" };
  refresh();
  return { ok: true, id: data.id };
}

const quickSets = z.object({
  said: z.string().trim().min(1).max(60),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(1000),
  weightLb: z.number().min(0).max(2000).nullable(),
});

/**
 * Quick add / voice: "bench 3x10 at 135" → 3 finished sets of Bench press.
 * They join the workout you have going, or today's, or a new one for today.
 * An exercise we don't know yet is added to your list under that name.
 */
export async function logQuickSetsAction(input: z.input<typeof quickSets>): Promise<Result<{ exercise: string; created: boolean }>> {
  const p = quickSets.safeParse(input);
  if (!p.success) return { ok: false, error: "Say it like “bench 3x10 at 135”" };
  const { said, sets, reps, weightLb } = p.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { timeZone } = await loadSettings(supabase);
  const today = toLocalDate(new Date(), timeZone);

  // Which exercise?
  const { data: exercises } = await supabase.from("exercises").select("id, name");
  let exercise = matchExercise(said, exercises ?? []);
  let created = false;
  if (!exercise) {
    const name = said.charAt(0).toUpperCase() + said.slice(1);
    const { data, error } = await supabase.from("exercises").insert({ user_id: user.id, name, muscle: "other" }).select("id, name").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add the exercise" };
    exercise = data;
    created = true;
  }

  // Which workout? The open one, else one from today, else a new one.
  const { data: recent } = await supabase
    .from("workouts")
    .select("id, started_at, ended_at")
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(5);
  const open = (recent ?? []).find((w) => w.ended_at === null);
  const todays = (recent ?? []).find((w) => w.ended_at !== null && toLocalDate(new Date(w.started_at), timeZone) === today);
  let workoutId = open?.id ?? todays?.id;
  const now = new Date().toISOString();
  if (!workoutId) {
    const { data, error } = await supabase.from("workouts").insert({ started_at: now, ended_at: now }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't start a workout" };
    workoutId = data.id;
  } else if (!open) {
    await supabase.from("workouts").update({ ended_at: now }).eq("id", workoutId);
  }

  const { count } = await supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", workoutId);
  const rows = Array.from({ length: sets }, (_, i) => ({
    workout_id: workoutId,
    exercise_id: exercise.id,
    position: (count ?? 0) + i,
    weight_lb: weightLb,
    reps,
    done: true,
  }));
  const { error } = await supabase.from("workout_sets").insert(rows);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, exercise: exercise.name, created };
}

/** Voice/quick add: "ran 2 miles in 18 minutes" → a finished workout named "Run · 2 mi · 18 min". */
export async function logCardioAction(input: { name: string; miles: number | null; minutes: number | null }): Promise<Result<{ label: string }>> {
  const name = input.name.trim().slice(0, 40) || "Workout";
  const miles = input.miles !== null && input.miles > 0 && input.miles < 500 ? input.miles : null;
  const minutes = input.minutes !== null && input.minutes > 0 && input.minutes < 1440 ? Math.round(input.minutes) : null;
  const label = [name, miles !== null ? `${miles} mi` : null, minutes !== null ? `${minutes} min` : null].filter(Boolean).join(" · ");
  const supabase = await createClient();
  const end = new Date();
  const start = new Date(end.getTime() - (minutes ?? 0) * 60000);
  const { error } = await supabase.from("workouts").insert({ started_at: start.toISOString(), ended_at: end.toISOString(), name: label });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, label };
}

// ── Split rotation and whole-workout logging ───────────────────────────────

async function loadSplit(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("profiles").select("id, gym_split, gym_next").maybeSingle();
  const split = data?.gym_split?.length ? data.gym_split : DEFAULT_SPLIT;
  return { userId: data?.id ?? null, split, next: (data?.gym_next ?? 0) % split.length };
}

/** After training `day`, the next day up is the one after it. */
async function advanceAfter(supabase: Awaited<ReturnType<typeof createClient>>, day: string | null) {
  const { userId, split, next } = await loadSplit(supabase);
  if (!userId || !day) return;
  await supabase.from("profiles").update({ gym_next: nextAfter(split, day, next) }).eq("id", userId);
}

/** Skip today's split day: it's kept in history as skipped, and the next day comes up. */
export async function skipDayAction(): Promise<Result<{ skipped: string; next: string }>> {
  const supabase = await createClient();
  const { userId, split, next } = await loadSplit(supabase);
  if (!userId) return { ok: false, error: "Not signed in" };
  const day = split[next];
  const now = new Date().toISOString();
  await supabase.from("workouts").insert({ started_at: now, ended_at: now, split_day: day, skipped: true, name: `Skipped ${day}` });
  const after = (next + 1) % split.length;
  await supabase.from("profiles").update({ gym_next: after }).eq("id", userId);
  refresh();
  return { ok: true, skipped: day, next: split[after] };
}

/** Pick which split day is up next. */
export async function setNextDayAction(index: number): Promise<Result> {
  const supabase = await createClient();
  const { userId, split } = await loadSplit(supabase);
  if (!userId) return { ok: false, error: "Not signed in" };
  if (!Number.isInteger(index) || index < 0 || index >= split.length) return { ok: false, error: "Pick a day" };
  await supabase.from("profiles").update({ gym_next: index }).eq("id", userId);
  refresh();
  return { ok: true };
}

/** Change the split itself, e.g. ["Push", "Pull", "Legs"]. */
export async function saveSplitAction(days: string[]): Promise<Result> {
  const clean = days.map((d) => d.trim()).filter(Boolean).slice(0, 10);
  if (clean.length < 1 || clean.some((d) => d.length > 40)) return { ok: false, error: "Give each day a short name" };
  const supabase = await createClient();
  const { userId } = await loadSplit(supabase);
  if (!userId) return { ok: false, error: "Not signed in" };
  await supabase.from("profiles").update({ gym_split: clean, gym_next: 0 }).eq("id", userId);
  refresh();
  return { ok: true };
}

/**
 * The mic: a whole workout in one sentence → every exercise and set, saved
 * into today's workout with its split day and muscles. It's read again here
 * with the same reader the preview used, so what you saw is what's saved.
 */
export async function logSpokenWorkoutAction(text: string): Promise<Result<{ note: string; day: string | null; skipped?: string }>> {
  const said = text.trim().slice(0, 2000);
  if (!said) return { ok: false, error: "Say your workout" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { split, next } = await loadSplit(supabase);
  const { data: exercises } = await supabase.from("exercises").select("id, name, muscle, bodyweight");
  const w = readWorkout(said, exercises ?? [], split);

  if (w.skip && !w.entries.length) {
    const r = await skipDayAction();
    return r.ok ? { ok: true, note: `Skipped ${r.skipped}. Next up: ${r.next}`, day: null, skipped: r.skipped } : r;
  }
  // Nothing named and no muscles: count it as the planned day.
  const day = w.day ?? (w.entries.length ? null : split[next]);
  const { timeZone } = await loadSettings(supabase);
  const today = toLocalDate(new Date(), timeZone);

  // New exercises you named get added to your list.
  const idFor = new Map<string, string>();
  for (const e of w.entries) {
    if (e.exerciseId) continue;
    const { data } = await supabase.from("exercises").insert({ user_id: user.id, name: e.name.slice(0, 60), muscle: "other" }).select("id").single();
    if (data) idFor.set(e.name, data.id);
  }

  // Join the open workout, or one from today, or start one.
  const { data: recent } = await supabase
    .from("workouts")
    .select("id, started_at, ended_at, muscles, split_day")
    .is("deleted_at", null)
    .eq("skipped", false)
    .order("started_at", { ascending: false })
    .limit(5);
  const open = (recent ?? []).find((r) => r.ended_at === null);
  const todays = (recent ?? []).find((r) => r.ended_at !== null && toLocalDate(new Date(r.started_at), timeZone) === today);
  const existing = open ?? todays;
  const now = new Date().toISOString();
  const muscles = [...new Set([...(existing?.muscles ?? []), ...w.muscles])];
  const finalDay = existing?.split_day ?? day;
  let workoutId = existing?.id;
  if (!workoutId) {
    const { data, error } = await supabase.from("workouts").insert({ started_at: now, ended_at: now, split_day: finalDay, muscles }).select("id").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save" };
    workoutId = data.id;
  } else {
    await supabase
      .from("workouts")
      .update({ split_day: finalDay, muscles, ...(open ? {} : { ended_at: now }) })
      .eq("id", workoutId);
  }

  const { count } = await supabase.from("workout_sets").select("id", { count: "exact", head: true }).eq("workout_id", workoutId);
  let position = count ?? 0;
  const rows = w.entries.flatMap((e) => {
    const exerciseId = e.exerciseId ?? idFor.get(e.name);
    if (!exerciseId) return [];
    const sets = e.sets.length ? e.sets : [{ weightLb: null, reps: null }];
    return sets.map((s) => ({ workout_id: workoutId, exercise_id: exerciseId, position: position++, weight_lb: s.weightLb, reps: s.reps, done: true }));
  });
  if (rows.length) {
    const { error } = await supabase.from("workout_sets").insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  await advanceAfter(supabase, finalDay);

  // Count it for a gym habit, if there is one.
  const { data: habits } = await supabase.from("habits").select("id, name").is("deleted_at", null).eq("archived", false);
  const gymHabit = (habits ?? []).find((h) => /\b(gym|workout|work out|lift|lifting|exercise|train)/i.test(h.name));
  if (gymHabit) await supabase.from("habit_checkins").upsert({ habit_id: gymHabit.id, on_date: today }, { onConflict: "habit_id,on_date", ignoreDuplicates: true });

  refresh();
  return { ok: true, note: workoutNote({ day: finalDay, entries: w.entries }), day: finalDay };
}
