"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { toLocalDate } from "@/lib/time";
import { lastTime, newRecords, volume, type GymSet } from "@/lib/gym";

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

  await supabase.from("workouts").update({ ended_at: new Date().toISOString() }).eq("id", workoutId);

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
