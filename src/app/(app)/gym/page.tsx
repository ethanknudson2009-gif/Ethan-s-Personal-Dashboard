import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { addDays, toLocalDate } from "@/lib/time";
import { bestByExercise, lastTime, setLabel, volume, type GymSet } from "@/lib/gym";
import { PageHeader } from "@/components/ui";
import { ActiveWorkout, StartWorkout, type Block, type ExerciseOption } from "@/components/gym-parts";

type SetRow = { id: string; exercise_id: string; position: number; weight_lb: number | null; reps: number | null; done: boolean };

const toGym = (s: SetRow): GymSet => ({ exerciseId: s.exercise_id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps, done: s.done });

/** Gym: log a workout set by set, with last time pre-filled, a rest timer and PRs. */
export default async function GymPage() {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const today = toLocalDate(new Date(), timeZone);

  const [{ data: exercises }, { data: open }, { data: past }] = await Promise.all([
    supabase.from("exercises").select("id, name, muscle").order("name"),
    supabase
      .from("workouts")
      .select("id, started_at, workout_sets(id, exercise_id, position, weight_lb, reps, done)")
      .is("ended_at", null)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, started_at, ended_at, name, workout_sets(id, exercise_id, position, weight_lb, reps, done)")
      .not("ended_at", "is", null)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(30),
  ]);

  const names = new Map((exercises ?? []).map((e) => [e.id, e.name]));
  const history = (past ?? []).map((w) => (w.workout_sets ?? []).map(toGym));
  const usedBefore = new Set(history.flat().map((s) => s.exerciseId));
  const options: ExerciseOption[] = (exercises ?? []).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, recent: usedBefore.has(e.id) }));

  // The live workout, grouped by exercise in the order they were added.
  const blocks: Block[] = [];
  if (open) {
    const sets = [...(open.workout_sets ?? [])].sort((a, b) => a.position - b.position);
    for (const s of sets) {
      let b = blocks.find((x) => x.exerciseId === s.exercise_id);
      if (!b) {
        const prev = lastTime(s.exercise_id, history);
        b = { exerciseId: s.exercise_id, name: names.get(s.exercise_id) ?? "Exercise", last: prev.length ? prev.map(setLabel).join(", ") : null, sets: [] };
        blocks.push(b);
      }
      b.sets.push({ id: s.id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps, done: s.done });
    }
  }

  // This week's numbers.
  const weekAgo = addDays(today, -6);
  const thisWeek = (past ?? []).filter((w) => toLocalDate(new Date(w.started_at), timeZone) >= weekAgo);
  const weekVolume = thisWeek.reduce((n, w) => n + volume((w.workout_sets ?? []).map(toGym)), 0);
  const bests = [...bestByExercise(history.flat()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Gym" subtitle="Life">
        <Link href="/life" className="text-sm text-muted hover:text-ink">
          ← Habits
        </Link>
      </PageHeader>

      <section className="hero hero-gym glow-gym rounded-3xl border bg-surface/70 p-5" style={{ borderColor: "#ff6b4a66" }}>
        <p className="text-xs font-medium tracking-[0.16em] uppercase" style={{ color: "#ff6b4a" }}>
          This week
        </p>
        <div className="mt-1 flex items-end gap-6">
          <div>
            <p className="font-display text-4xl font-semibold tabular-nums">{thisWeek.length}</p>
            <p className="text-xs text-muted">workout{thisWeek.length === 1 ? "" : "s"}</p>
          </div>
          <div className="min-w-0">
            <p className="font-display text-4xl font-semibold tabular-nums">{weekVolume >= 10000 ? `${Math.round(weekVolume / 1000)}k` : weekVolume.toLocaleString()}</p>
            <p className="text-xs text-muted">lb moved</p>
          </div>
        </div>
        {!open && (
          <div className="mt-4">
            <StartWorkout />
          </div>
        )}
      </section>

      {open && <ActiveWorkout workoutId={open.id} startedAt={open.started_at} blocks={blocks} exercises={options} />}

      {bests.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase">🏆 Best lifts (estimated 1-rep max)</h2>
          <div className="rows grid grid-cols-2 gap-2">
            {bests.map(([id, e1rm]) => (
              <div key={id} className="rounded-2xl border border-line bg-surface/80 px-3 py-2.5">
                <p className="truncate text-xs text-muted">{names.get(id) ?? "Exercise"}</p>
                <p className="font-display text-xl font-semibold tabular-nums">
                  {e1rm} <span className="text-xs font-normal text-faint">lb</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase">History</h2>
        {(past ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            No workouts yet. Start one above: pick exercises, log sets, tap ✓. Next time, your numbers are pre-filled.
          </p>
        ) : (
          <ul className="rows flex flex-col gap-2">
            {(past ?? []).slice(0, 12).map((w) => {
              const sets = (w.workout_sets ?? []).map(toGym);
              const exIds = [...new Set(sets.map((s) => s.exerciseId))];
              const mins = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000) : 0;
              return (
                <li key={w.id} className="rounded-2xl border border-line bg-surface/80 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{dayLabel(w.started_at)}</p>
                    <p className="shrink-0 text-xs text-faint tabular-nums">
                      {mins} min · {volume(sets).toLocaleString()} lb
                    </p>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">
                    {exIds.length
                      ? exIds.map((id) => `${names.get(id) ?? "Exercise"} ×${sets.filter((s) => s.exerciseId === id).length}`).join(" · ")
                      : (w.name ?? "Workout")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
