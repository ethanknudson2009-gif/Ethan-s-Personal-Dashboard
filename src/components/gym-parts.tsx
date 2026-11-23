"use client";

/**
 * Interactive pieces of the Gym page: start a split day (pre-filled), the
 * live workout (tap ✓ per set), the exercise picker and the rest timer.
 *
 * Built for one thumb at the gym: big fields, the weight box selects itself
 * when tapped, "+ Set" copies the last set, and nothing is wider than the
 * phone.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addExerciseAction,
  addSetAction,
  createExerciseAction,
  deleteSetAction,
  discardWorkoutAction,
  finishWorkoutAction,
  removeExerciseAction,
  setNextDayAction,
  skipDayAction,
  startWorkoutAction,
  updateSetAction,
} from "@/app/(app)/gym/actions";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";
import { MUSCLE_LABELS, searchScore, type Muscle } from "@/lib/exercise-library";

const FIRE = "#ff6b4a";

export type ExerciseOption = { id: string; name: string; muscle: string; equipment: string | null; aliases: string[]; recent: boolean };
export type SetRowData = { id: string; weightLb: number | null; reps: number | null; done: boolean };
export type Block = { exerciseId: string; name: string; muscle: string; last: string | null; sets: SetRowData[] };

/** Set rows: number · weight · reps · ✓ · remove. minmax(0,…) lets the boxes shrink on a phone. */
const ROW = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_3rem_1.75rem] items-center gap-2";

const muscleLabel = (m: string) => MUSCLE_LABELS[m as Muscle] ?? m.charAt(0).toUpperCase() + m.slice(1);

export function StartWorkout({ label = "Start workout", day, big }: { label?: string; day?: string; big?: boolean }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await startWorkoutAction(day);
          if (!r.ok) return sheet.toast(r.error);
          if (r.from === "last time") sheet.toast(`Same as last ${day} day: change anything, then tap ✓`);
          else if (r.from === "starter") sheet.toast(`Starter ${day} workout: swap exercises any time`);
        })
      }
      className={cx(
        "glow-gym w-full rounded-2xl px-4 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50",
        big ? "py-4 text-lg" : "py-3.5 text-base",
      )}
      style={{ backgroundColor: FIRE }}
    >
      {pending ? "Getting it ready…" : `🏋️ ${label}`}
    </button>
  );
}

/** Soft "time to go" chime for the rest timer (made in the browser). */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch {
    // No sound available.
  }
}

function RestTimer({ until, onDone, onAdd }: { until: number; onDone: () => void; onAdd: (s: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left === 0) {
      beep();
      navigator.vibrate?.([120, 80, 120]);
      onDone();
    }
  }, [left, onDone]);
  return (
    <div
      className="fade-in fixed bottom-28 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border bg-surface/95 py-2 pr-2 pl-4 shadow-card backdrop-blur md:bottom-8"
      style={{ borderColor: `${FIRE}88`, boxShadow: `0 0 24px -6px ${FIRE}` }}
    >
      <span className="text-sm font-semibold">Rest</span>
      <span className="font-display text-xl font-semibold tabular-nums" style={{ color: FIRE }}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </span>
      <button type="button" onClick={() => onAdd(-15)} className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold">
        −15
      </button>
      <button type="button" onClick={() => onAdd(30)} className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold">
        +30
      </button>
      <button type="button" onClick={onDone} className="rounded-full px-2 py-1 text-xs text-muted">
        Skip
      </button>
    </div>
  );
}

function SetRow({ set, index, onDone }: { set: SetRowData; index: number; onDone: () => void }) {
  const sheet = useTaskSheet();
  const [weight, setWeight] = useState(set.weightLb?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const [done, setDone] = useState(set.done);
  const [, startTransition] = useTransition();
  const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
  const save = (patch: Parameters<typeof updateSetAction>[1]) =>
    startTransition(async () => {
      const r = await updateSetAction(set.id, patch);
      if (!r.ok) sheet.toast(r.error);
    });
  const field = "w-full min-w-0 rounded-xl border border-line bg-raised px-1 py-2.5 text-center font-display text-lg font-semibold tabular-nums text-ink placeholder:text-faint placeholder:font-normal placeholder:text-sm focus:border-[#ff6b4a] focus:outline-none";
  return (
    <div className={cx(ROW, "rounded-xl py-1 transition", done && "bg-[#ff6b4a]/10")}>
      <span className="text-center text-xs font-semibold text-muted">{index + 1}</span>
      <input
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => num(weight) !== set.weightLb && save({ weightLb: num(weight) })}
        inputMode="decimal"
        enterKeyHint="next"
        placeholder="lb"
        aria-label={`Set ${index + 1} weight`}
        className={field}
      />
      <input
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => num(reps) !== set.reps && save({ reps: num(reps) === null ? null : Math.round(num(reps)!) })}
        inputMode="numeric"
        enterKeyHint="done"
        placeholder="reps"
        aria-label={`Set ${index + 1} reps`}
        className={field}
      />
      <button
        type="button"
        aria-label={done ? "Not done" : "Done"}
        onClick={() => {
          const next = !done;
          setDone(next);
          save({ done: next, weightLb: num(weight), reps: num(reps) === null ? null : Math.round(num(reps)!) });
          if (next) onDone();
        }}
        className={cx(
          "flex h-11 items-center justify-center rounded-xl border-2 text-lg font-bold transition active:scale-90",
          done ? "check-ring-done border-transparent text-white" : "border-line text-faint",
        )}
        style={done ? { backgroundColor: FIRE, boxShadow: `0 0 14px -2px ${FIRE}` } : undefined}
      >
        ✓
      </button>
      <button
        type="button"
        aria-label="Remove set"
        onClick={() =>
          startTransition(async () => {
            await deleteSetAction(set.id);
          })
        }
        className="flex h-11 items-center justify-center text-sm text-faint hover:text-danger"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * Pick exercises: search by name or nickname ("rdl", "pec deck"), or browse
 * by muscle. Tap to add; it stays open so you can add several, then Done.
 */
function ExercisePicker({
  workoutId,
  exercises,
  inWorkout,
  dayMuscles,
  dayName,
  onClose,
}: {
  workoutId: string;
  exercises: ExerciseOption[];
  inWorkout: Set<string>;
  dayMuscles: string[];
  dayName: string | null;
  onClose: () => void;
}) {
  const sheet = useTaskSheet();
  const [q, setQ] = useState("");
  const hasDay = dayMuscles.some((m) => exercises.some((e) => e.muscle === m));
  const [tab, setTab] = useState<string>(hasDay ? "day" : exercises.some((e) => e.recent) ? "recent" : "chest");
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const muscles = useMemo(() => Object.keys(MUSCLE_LABELS).filter((m) => exercises.some((e) => e.muscle === m)), [exercises]);
  const others = useMemo(() => [...new Set(exercises.map((e) => e.muscle))].filter((m) => !muscles.includes(m)), [exercises, muscles]);

  const list = useMemo(() => {
    if (q.trim()) {
      return exercises
        .map((e) => ({ e, s: searchScore(q, e.name, e.aliases) + (e.recent ? 3 : 0) }))
        .filter((x) => x.s > 3 || (x.s > 0 && !x.e.recent))
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((x) => x.e);
    }
    const pick = tab === "day" ? exercises.filter((e) => dayMuscles.includes(e.muscle)) : tab === "recent" ? exercises.filter((e) => e.recent) : exercises.filter((e) => e.muscle === tab);
    // Ones you've done before first, then A–Z.
    return [...pick].sort((a, b) => Number(b.recent) - Number(a.recent) || a.name.localeCompare(b.name));
  }, [q, tab, exercises, dayMuscles]);

  const add = (id: string) => {
    setAdded((s) => new Set(s).add(id));
    startTransition(async () => {
      const r = await addExerciseAction(workoutId, id);
      if (!r.ok) {
        setAdded((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        sheet.toast(r.error);
      }
    });
  };

  // Lock the page behind the picker while it's open.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  const tabs = [
    ...(hasDay ? [{ key: "day", label: `🔥 ${dayName ?? "Today"}` }] : []),
    ...(exercises.some((e) => e.recent) ? [{ key: "recent", label: "⭐ Done before" }] : []),
    ...muscles.map((m) => ({ key: m, label: muscleLabel(m) })),
    ...others.map((m) => ({ key: m, label: muscleLabel(m) })),
  ];

  return (
    <div className="fade-in fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur" role="dialog" aria-label="Add exercises">
      <div className="mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${exercises.length} exercises (try “rdl”)`}
            className="w-full min-w-0 flex-1 rounded-2xl border border-line bg-raised px-4 py-3 text-base text-ink placeholder:text-faint focus:border-[#ff6b4a] focus:outline-none"
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-2xl px-4 py-3 text-base font-semibold text-white"
            style={{ backgroundColor: FIRE }}
          >
            Done{added.size ? ` (${added.size})` : ""}
          </button>
        </div>

        {!q && (
          <div className="-mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition",
                  tab === t.key ? "border-transparent font-semibold text-white" : "border-line bg-raised text-muted",
                )}
                style={tab === t.key ? { backgroundColor: FIRE } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {list.length === 0 && <li className="py-6 text-center text-sm text-muted">{q ? "Not in the list. Add it below." : "Nothing here yet."}</li>}
          {list.map((e) => {
            const isIn = inWorkout.has(e.id) || added.has(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={isIn}
                  onClick={() => add(e.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-raised active:scale-[0.99] disabled:opacity-100"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {e.name}
                      {e.recent && <span className="ml-1.5 text-xs">⭐</span>}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {muscleLabel(e.muscle)}
                      {e.equipment ? ` · ${e.equipment}` : ""}
                    </span>
                  </span>
                  <span
                    className={cx("flex size-8 shrink-0 items-center justify-center rounded-full border text-base font-bold", isIn ? "border-transparent text-white" : "border-line text-muted")}
                    style={isIn ? { backgroundColor: FIRE } : undefined}
                  >
                    {isIn ? "✓" : "+"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {q.trim() && !exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const muscle = tab === "day" || tab === "recent" ? (dayMuscles[0] ?? "other") : tab;
                const r = await createExerciseAction(q, muscle);
                if (!r.ok) return sheet.toast(r.error);
                const r2 = await addExerciseAction(workoutId, r.id);
                if (!r2.ok) return sheet.toast(r2.error);
                setAdded((s) => new Set(s).add(r.id));
                setQ("");
              })
            }
            className="shrink-0 rounded-2xl border border-dashed border-line px-4 py-3 text-sm font-semibold text-muted"
          >
            + Add “{q.trim()}” as a new exercise
          </button>
        )}
      </div>
    </div>
  );
}

export function ActiveWorkout({
  workoutId,
  startedAt,
  day,
  dayMuscles,
  blocks,
  exercises,
}: {
  workoutId: string;
  startedAt: string;
  day: string | null;
  dayMuscles: string[];
  blocks: Block[];
  exercises: ExerciseOption[];
}) {
  const sheet = useTaskSheet();
  const [picking, setPicking] = useState(blocks.length === 0);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const restLength = useRef(90);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  const allSets = blocks.flatMap((b) => b.sets);
  const doneSets = allSets.filter((s) => s.done).length;
  const inWorkout = useMemo(() => new Set(blocks.map((b) => b.exerciseId)), [blocks]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header: time, progress, Finish */}
      <div className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-surface/95 px-4 py-3 backdrop-blur" style={{ borderColor: `${FIRE}55` }}>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: FIRE }}>
            ● {day ? `${day} day` : "Live workout"}
          </p>
          <p className="font-display text-lg font-semibold tabular-nums">
            {mins} min · {doneSets}/{allSets.length} sets
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await finishWorkoutAction(workoutId);
              if (!r.ok) return sheet.toast(r.error);
              setRestUntil(null);
              const pr = r.records.length ? ` · 🏆 ${r.records.length} PR${r.records.length === 1 ? "" : "s"}: ${r.records.map((x) => x.name).join(", ")}` : "";
              sheet.toast(`Workout done ✓ ${r.volume.toLocaleString()} lb${pr}`);
            })
          }
          className="glow-gym shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95"
          style={{ backgroundColor: FIRE }}
        >
          Finish
        </button>
      </div>

      {blocks.length > 0 && doneSets === 0 && (
        <p className="px-1 text-xs text-muted">Weights are from last time. Change a number if needed, then tap ✓ after each set. A rest timer starts.</p>
      )}

      {blocks.map((b) => {
        const done = b.sets.filter((s) => s.done).length;
        return (
          <section key={b.exerciseId} className="min-w-0 rounded-3xl border border-line bg-surface/85 p-3.5 shadow-card">
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{b.name}</h3>
                <p className="truncate text-xs text-faint">
                  {muscleLabel(b.muscle)}
                  {b.last ? ` · Last: ${b.last}` : ""}
                </p>
              </div>
              <span className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums" style={{ color: done === b.sets.length && done > 0 ? FIRE : undefined }}>
                {done}/{b.sets.length}
              </span>
              <button
                type="button"
                aria-label={`Remove ${b.name}`}
                onClick={() =>
                  window.confirm(`Take ${b.name} out of this workout?`) &&
                  startTransition(async () => {
                    const r = await removeExerciseAction(workoutId, b.exerciseId);
                    if (!r.ok) sheet.toast(r.error);
                  })
                }
                className="-mt-1 -mr-1 shrink-0 rounded-lg px-2 py-1 text-sm text-faint hover:text-danger"
              >
                ✕
              </button>
            </div>
            <div className={cx(ROW, "mb-1 text-center text-[10px] tracking-wider text-faint uppercase")}>
              <span>Set</span>
              <span>Lb</span>
              <span>Reps</span>
              <span />
              <span />
            </div>
            <div className="flex flex-col gap-1">
              {b.sets.map((s, i) => (
                <SetRow key={s.id} set={s} index={i} onDone={() => setRestUntil(Date.now() + restLength.current * 1000)} />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const lastSet = b.sets[b.sets.length - 1];
                  await addSetAction(workoutId, b.exerciseId, lastSet?.weightLb ?? null, lastSet?.reps ?? null);
                })
              }
              className="mt-2 w-full rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-muted hover:text-ink"
            >
              + Set
            </button>
          </section>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="rounded-2xl border border-dashed px-3 py-3.5 text-sm font-semibold transition hover:bg-[#ff6b4a]/10"
          style={{ borderColor: `${FIRE}88`, color: FIRE }}
        >
          + Add exercise
        </button>
        <button
          type="button"
          onClick={() => sheet.openVoice()}
          className="rounded-2xl border border-line px-3 py-3.5 text-sm font-semibold text-muted transition hover:text-ink"
        >
          🎤 Say sets
        </button>
      </div>

      <button
        type="button"
        onClick={() =>
          window.confirm("Throw away this workout?") &&
          startTransition(async () => {
            await discardWorkoutAction(workoutId);
          })
        }
        className="self-center py-2 text-xs text-faint hover:text-danger"
      >
        Discard workout
      </button>

      {picking && (
        <ExercisePicker
          workoutId={workoutId}
          exercises={exercises}
          inWorkout={inWorkout}
          dayMuscles={dayMuscles}
          dayName={day}
          onClose={() => setPicking(false)}
        />
      )}

      {restUntil && (
        <RestTimer
          until={restUntil}
          onDone={() => setRestUntil(null)}
          onAdd={(s) => {
            restLength.current = Math.min(300, Math.max(30, restLength.current + s));
            setRestUntil((u) => Math.max(Date.now() + 5000, (u ?? Date.now()) + s * 1000));
          }}
        />
      )}
    </div>
  );
}

/**
 * Your split: which day is up and one big button to start it (ready with
 * last time's exercises), the whole rotation (tap a day to do that one
 * instead), Skip, and the mic for saying a whole workout after the fact.
 */
export function SplitCard({ split, next, lastDone }: { split: string[]; next: number; lastDone: Record<string, string> }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const day = split[next];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.16em] uppercase" style={{ color: FIRE }}>
            Up next
          </p>
          <p className="font-display text-3xl leading-tight font-semibold">{day}</p>
          <p className="text-xs text-muted">{lastDone[day] ? `Last time: ${lastDone[day]}` : "Not trained yet"}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await skipDayAction();
              sheet.toast(r.ok ? `⏭️ Skipped ${r.skipped}. Next up: ${r.next}` : r.error);
            })
          }
          className="shrink-0 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-muted transition hover:text-ink active:scale-95"
        >
          Skip ⏭️
        </button>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {split.map((d, i) => (
          <button
            key={d}
            type="button"
            disabled={pending}
            onClick={() =>
              i !== next &&
              startTransition(async () => {
                const r = await setNextDayAction(i);
                if (!r.ok) sheet.toast(r.error);
              })
            }
            className={cx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition",
              i === next ? "text-white" : "border-line text-muted hover:text-ink",
            )}
            style={i === next ? { backgroundColor: FIRE, borderColor: FIRE } : undefined}
          >
            {i === next ? "● " : ""}
            {d}
          </button>
        ))}
      </div>

      <StartWorkout big day={day} label={`Start ${day} day`} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => sheet.openVoice()}
          className="rounded-2xl border px-3 py-3 text-sm font-semibold transition active:scale-[0.98]"
          style={{ borderColor: `${FIRE}88`, color: FIRE }}
        >
          🎤 Say a workout
        </button>
        <EmptyStart />
      </div>
      <p className="text-[11px] leading-snug text-faint">
        Already done? Say it all at once: “{day.toLowerCase()} day, bench 3x10 at 135, incline 3 sets of 8 at 50”. Or “skip {day.toLowerCase()} day”.
      </p>
    </div>
  );
}

function EmptyStart() {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await startWorkoutAction();
          if (!r.ok) sheet.toast(r.error);
        })
      }
      className="rounded-2xl border border-line px-3 py-3 text-sm font-semibold text-muted transition hover:text-ink active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Starting…" : "Empty workout"}
    </button>
  );
}

/** One past workout as a clean note; tap to open, copy or delete it. */
export function WorkoutNoteCard({
  id,
  date,
  day,
  skipped,
  lines,
  meta,
  note,
}: {
  id: string;
  date: string;
  day: string | null;
  skipped: boolean;
  lines: { name: string; sets: string }[];
  meta: string;
  note: string;
}) {
  const sheet = useTaskSheet();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  if (skipped) {
    return (
      <li className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-faint">
        <span>
          {date} · ⏭️ Skipped {day ?? "day"}
        </span>
      </li>
    );
  }
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface/80">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate font-semibold">
            {day ? (
              <span className="mr-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: FIRE }}>
                {day}
              </span>
            ) : null}
            {date}
          </p>
          <p className="shrink-0 text-xs text-faint tabular-nums">{meta}</p>
        </div>
        <ul className={cx("mt-1.5 flex flex-col gap-0.5 text-sm", !open && "max-h-[4.5rem] overflow-hidden")}>
          {lines.map((l) => (
            <li key={l.name} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-muted">{l.name}</span>
              <span className="shrink-0 font-display text-xs font-semibold tabular-nums">{l.sets}</span>
            </li>
          ))}
        </ul>
        {!open && lines.length > 3 && <p className="mt-1 text-[11px] text-faint">+{lines.length - 3} more · tap to open</p>}
      </button>
      {open && (
        <div className="fade-in flex gap-2 border-t border-line px-4 py-2.5">
          <button
            type="button"
            onClick={() =>
              navigator.clipboard
                ?.writeText(note)
                .then(() => sheet.toast("Note copied ✓"))
                .catch(() => sheet.toast("Couldn't copy"))
            }
            className="rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold"
          >
            Copy note
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              window.confirm("Delete this workout?") &&
              startTransition(async () => {
                const r = await discardWorkoutAction(id);
                sheet.toast(r.ok ? "Workout deleted" : r.error);
              })
            }
            className="ml-auto rounded-lg px-3 py-1.5 text-xs text-faint hover:text-danger"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
