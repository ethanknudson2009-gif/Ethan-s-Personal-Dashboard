import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { addDays, toLocalDate } from "@/lib/time";
import { bestByExercise, lastTime, setLabel, volume, type GymSet } from "@/lib/gym";
import { DEFAULT_SPLIT, setsSummary, workoutNote, type SpokenEntry } from "@/lib/gym-speech";
import { PageHeader } from "@/components/ui";
import { ActiveWorkout, SplitCard, WorkoutNoteCard, type Block, type ExerciseOption } from "@/components/gym-parts";
import { GymCharts } from "@/components/gym-charts";
import { EXERCISE_LIBRARY, libraryEntry } from "@/lib/exercise-library";
import { musclesOfDay, STARTERS } from "@/lib/gym-plan";
import { chartableExercises, splitCounts, strengthSeries, weeklyVolume, type PastWorkout } from "@/lib/gym-progress";

/** The best-known lifts, listed first in the picker. */
const POPULAR = [...new Set(Object.values(STARTERS).flat())];

/** Split-day words that cover several muscle groups. */
const MUSCLE_GROUPS: Record<string, string[]> = {
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps"],
  "upper body": ["chest", "back", "shoulders", "biceps", "triceps"],
  "lower body": ["legs", "glutes"],
  "full body": ["chest", "back", "legs", "shoulders"],
  arms: ["biceps", "triceps", "forearms"],
  legs: ["legs", "glutes"],
};

type SetRow = { id: string; exercise_id: string; position: number; weight_lb: number | null; reps: number | null; done: boolean };

const toGym = (s: SetRow): GymSet => ({ exerciseId: s.exercise_id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps, done: s.done });

/**
 * Gym: your split (what's up next, Skip), say a whole workout at once or log
 * it live set by set, best lifts, and every workout as a clean note.
 */
export default async function GymPage() {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const today = toLocalDate(new Date(), timeZone);

  const [{ data: exercises }, { data: open }, { data: past }, { data: profile }] = await Promise.all([
    supabase.from("exercises").select("id, name, muscle, equipment").order("name"),
    supabase
      .from("workouts")
      .select("id, started_at, split_day, workout_sets(id, exercise_id, position, weight_lb, reps, done)")
      .is("ended_at", null)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workouts")
      .select("id, started_at, ended_at, name, split_day, muscles, skipped, workout_sets(id, exercise_id, position, weight_lb, reps, done)")
      .not("ended_at", "is", null)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(150), // enough for months of progress charts
    supabase.from("profiles").select("gym_split, gym_next").maybeSingle(),
  ]);

  const split = profile?.gym_split?.length ? profile.gym_split : DEFAULT_SPLIT;
  const next = (profile?.gym_next ?? 0) % split.length;
  const names = new Map((exercises ?? []).map((e) => [e.id, e.name]));
  const trained = (past ?? []).filter((w) => !w.skipped);
  const history = trained.map((w) => (w.workout_sets ?? []).map(toGym));
  const usedBefore = new Set(history.flat().map((s) => s.exerciseId));
  const options: ExerciseOption[] = (exercises ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscle: e.muscle,
    equipment: e.equipment,
    aliases: libraryEntry(e.name)?.aliases ?? [],
    recent: usedBefore.has(e.id),
    // Popular lifts first (the starter lists), then the library's order, then your own.
    rank: (() => {
      const popular = POPULAR.indexOf(e.name);
      if (popular >= 0) return popular;
      const entry = libraryEntry(e.name);
      return entry ? 100 + EXERCISE_LIBRARY.indexOf(entry) : 10_000;
    })(),
  }));
  const muscleById = new Map((exercises ?? []).map((e) => [e.id, e.muscle]));
  // The muscles for the picker's "🔥 Chest" tab: the live workout's day, else the next one up.
  const liveDay = open?.split_day ?? null;
  const dayMuscles = [...new Set(musclesOfDay(liveDay ?? split[next]).flatMap((m) => (m in MUSCLE_GROUPS ? MUSCLE_GROUPS[m] : [m])))];

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));

  // When each split day was last trained.
  const lastDone: Record<string, string> = {};
  for (const w of trained) if (w.split_day && !lastDone[w.split_day]) lastDone[w.split_day] = dayLabel(w.started_at);

  // The live workout, grouped by exercise in the order they were added.
  const blocks: Block[] = [];
  if (open) {
    const sets = [...(open.workout_sets ?? [])].sort((a, b) => a.position - b.position);
    for (const s of sets) {
      let b = blocks.find((x) => x.exerciseId === s.exercise_id);
      if (!b) {
        const prev = lastTime(s.exercise_id, history);
        b = { exerciseId: s.exercise_id, name: names.get(s.exercise_id) ?? "Exercise", muscle: muscleById.get(s.exercise_id) ?? "other", last: prev.length ? prev.map(setLabel).join(", ") : null, sets: [] };
        blocks.push(b);
      }
      b.sets.push({ id: s.id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps, done: s.done });
    }
  }

  // This week's numbers.
  const weekAgo = addDays(today, -6);
  const thisWeek = trained.filter((w) => toLocalDate(new Date(w.started_at), timeZone) >= weekAgo);
  const weekVolume = thisWeek.reduce((n, w) => n + volume((w.workout_sets ?? []).map(toGym)), 0);
  const bests = [...bestByExercise(history.flat()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  // Progress charts: strength per lift, pounds per week, split balance.
  const pastForCharts: PastWorkout[] = (past ?? []).map((w) => ({
    date: toLocalDate(new Date(w.started_at), timeZone),
    day: w.split_day,
    skipped: w.skipped,
    sets: (w.workout_sets ?? []).map(toGym),
  }));
  const lifts = chartableExercises(pastForCharts)
    .slice(0, 12)
    .map((l) => ({ id: l.exerciseId, name: names.get(l.exerciseId) ?? "Exercise", sessions: l.sessions }));
  const series = Object.fromEntries(lifts.map((l) => [l.id, strengthSeries(pastForCharts, l.id)]));
  const weeks = weeklyVolume(pastForCharts, today, 8);
  const balance = splitCounts(pastForCharts, split, addDays(today, -29));

  // Each past workout as a standard note: one line per exercise.
  const notes = (past ?? []).slice(0, 20).map((w) => {
    const sets = [...(w.workout_sets ?? [])].sort((a, b) => a.position - b.position);
    const entries: SpokenEntry[] = [];
    for (const s of sets) {
      let e = entries.find((x) => x.exerciseId === s.exercise_id);
      if (!e) {
        e = { exerciseId: s.exercise_id, name: names.get(s.exercise_id) ?? "Exercise", sets: [] };
        entries.push(e);
      }
      e.sets.push({ weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps });
    }
    const mins = w.ended_at ? Math.round((new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000) : 0;
    const lb = volume(sets.map(toGym));
    const meta = [mins > 0 ? `${mins} min` : null, lb ? `${lb.toLocaleString()} lb` : null, entries.length ? null : w.name].filter(Boolean).join(" · ");
    return {
      id: w.id,
      date: dayLabel(w.started_at),
      day: w.split_day,
      skipped: w.skipped,
      lines: entries.map((e) => ({ name: e.name, sets: setsSummary(e.sets) })),
      // Every set with its id, so the card can fix a weight or rep count later.
      exercises: entries.map((e) => ({
        exerciseId: e.exerciseId ?? "",
        name: e.name,
        sets: sets
          .filter((s) => s.exercise_id === e.exerciseId)
          .map((s) => ({ id: s.id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps })),
      })),
      meta,
      note: `${dayLabel(w.started_at)} · ${workoutNote({ day: w.split_day, entries })}`,
    };
  });

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Gym" subtitle="Lift · track · progress" />

      <section className="hero hero-gym glow-gym rounded-3xl border bg-surface/70 p-5" style={{ borderColor: "#ff6b4a66" }}>
        {open ? (
          <p className="font-display text-xl font-semibold">Workout in progress 🔥</p>
        ) : (
          <SplitCard split={split} next={next} lastDone={lastDone} />
        )}
        <div className="mt-4 flex items-end gap-6 border-t border-line/60 pt-3">
          <div>
            <p className="font-display text-2xl font-semibold tabular-nums">{thisWeek.length}</p>
            <p className="text-[11px] text-muted">workout{thisWeek.length === 1 ? "" : "s"} this week</p>
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold tabular-nums">{weekVolume >= 10000 ? `${Math.round(weekVolume / 1000)}k` : weekVolume.toLocaleString()}</p>
            <p className="text-[11px] text-muted">lb moved</p>
          </div>
        </div>
      </section>

      {open && <ActiveWorkout workoutId={open.id} startedAt={open.started_at} day={liveDay} dayMuscles={dayMuscles} blocks={blocks} exercises={options} />}

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

      <GymCharts lifts={lifts} series={series} weeks={weeks} split={balance} />

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-[0.16em] text-muted uppercase">History</h2>
        {notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            No workouts yet. Tap 🎤 and say your whole workout, or log it live set by set.
          </p>
        ) : (
          <ul className="rows flex flex-col gap-2">
            {notes.map((n) => (
              <WorkoutNoteCard key={n.id} {...n} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
