"use client";

/**
 * Interactive pieces of the Gym page: start a split day (pre-filled), the
 * live workout (tap ✓ per set) and the rest timer. The exercise picker is in
 * gym-picker.tsx and past workouts are in gym-history.tsx.
 *
 * Built for one thumb at the gym: big fields that select themselves when
 * tapped, −5/+5 nudge buttons under the box you're in (no keyboard needed),
 * an empty set shows the one above in grey and ✓ copies it, "+ Set" copies
 * the last set, and nothing is wider than the phone.
 */
import { playSound } from "@/lib/sound";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSetAction,
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
import { ExercisePicker, partLabel } from "@/components/gym-picker";

const FIRE = "#ff6b4a";

/** `rank`: the library's order (most common first); your own exercises come after. */
export type ExerciseOption = {
  id: string;
  name: string;
  muscle: string;
  equipment: string | null;
  aliases: string[];
  recent: boolean;
  rank: number;
};
export type SetRowData = {
  id: string;
  weightLb: number | null;
  reps: number | null;
  done: boolean;
};
/** `bodyweight`: push-ups, pull-ups, dips… only reps are asked for (tap "Bodyweight" to add a vest or belt). */
export type Block = {
  exerciseId: string;
  name: string;
  muscle: string;
  bodyweight: boolean;
  last: string | null;
  sets: SetRowData[];
};

/** Set rows: number · weight · reps · ✓ · remove. minmax(0,…) lets the boxes shrink on a phone. */
const ROW =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_3rem_1.75rem] items-center gap-2";

export function StartWorkout({
  label = "Start workout",
  day,
  big,
  goTo,
}: {
  label?: string;
  day?: string;
  big?: boolean;
  /** Where to go once it's ready (Home's card jumps to the Gym page). */
  goTo?: string;
}) {
  const sheet = useTaskSheet();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await startWorkoutAction(day);
          if (!r.ok) return sheet.toast(r.error);
          if (goTo) router.push(goTo);
          if (r.from === "last time")
            sheet.toast(`Same as last ${day} day: change anything, then tap ✓`);
          else if (r.from === "starter")
            sheet.toast(`Starter ${day} workout: swap exercises any time`);
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

function RestTimer({
  until,
  onDone,
  onAdd,
}: {
  until: number;
  onDone: () => void;
  onAdd: (s: number) => void;
}) {
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
      <span
        className="font-display text-xl font-semibold tabular-nums"
        style={{ color: FIRE }}
      >
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={() => onAdd(-15)}
        className="rounded-full bg-raised px-3.5 py-2 text-xs font-semibold"
      >
        −15
      </button>
      <button
        type="button"
        onClick={() => onAdd(30)}
        className="rounded-full bg-raised px-3.5 py-2 text-xs font-semibold"
      >
        +30
      </button>
      <button
        type="button"
        onClick={onDone}
        className="rounded-full px-3 py-2 text-xs text-muted"
      >
        Skip
      </button>
    </div>
  );
}

/** Quick nudges shown under the box you're typing in, so most sets need no keyboard. */
const NUDGE = { w: [-10, -5, 5, 10], r: [-2, -1, 1, 2] } as const;

function SetRow({
  set,
  index,
  prev,
  bodyweight = false,
  onDone,
}: {
  set: SetRowData;
  index: number;
  prev?: SetRowData;
  bodyweight?: boolean;
  onDone: () => void;
}) {
  const sheet = useTaskSheet();
  const [weight, setWeight] = useState(set.weightLb?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const [done, setDone] = useState(set.done);
  const [focus, setFocus] = useState<"w" | "r" | null>(null);
  // Bodyweight moves hide the weight box until you add weight (a vest, a dip belt).
  const [withWeight, setWithWeight] = useState(
    !bodyweight || set.weightLb !== null || prev?.weightLb != null,
  );
  const repsBox = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const num = (v: string) =>
    v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v);
  const save = (patch: Parameters<typeof updateSetAction>[1]) =>
    startTransition(async () => {
      const r = await updateSetAction(set.id, patch);
      if (!r.ok) sheet.toast(r.error);
    });
  // An empty box shows the set above in grey; ✓ on an empty set copies it.
  const ghostW = withWeight ? (prev?.weightLb ?? null) : null;
  const ghostR = prev?.reps ?? null;

  function nudge(which: "w" | "r", by: number) {
    if (which === "w") {
      const base = num(weight) ?? ghostW ?? 0;
      setWeight(String(Math.max(0, base + by)));
    } else {
      const base = num(reps) ?? ghostR ?? 0;
      setReps(String(Math.max(0, Math.round(base + by))));
    }
  }

  function toggleDone() {
    const next = !done;
    let w = num(weight);
    let r = num(reps) === null ? null : Math.round(num(reps)!);
    if (next) {
      if (w === null && ghostW !== null) {
        w = ghostW;
        setWeight(String(ghostW));
      }
      if (r === null && ghostR !== null) {
        r = ghostR;
        setReps(String(ghostR));
      }
    }
    playSound(next ? "done" : "undo");
    setDone(next);
    save({ done: next, weightLb: w, reps: r });
    if (next) onDone();
  }

  const field =
    "w-full min-w-0 rounded-xl border border-line bg-raised px-1 py-2.5 text-center font-display text-lg font-semibold tabular-nums text-ink placeholder:text-faint placeholder:font-normal focus:border-[#ff6b4a] focus:outline-none";
  return (
    <div
      className={cx("rounded-xl py-1 transition", done && "bg-[#ff6b4a]/10")}
    >
      <div className={ROW}>
        <span className="text-center text-xs font-semibold text-muted">
          {index + 1}
        </span>
        {!withWeight ? (
          <button
            type="button"
            onClick={() => setWithWeight(true)}
            aria-label={`Set ${index + 1}: bodyweight (tap to add weight)`}
            className="h-11 rounded-xl border border-dashed border-line text-xs font-semibold text-muted"
          >
            Bodyweight
          </button>
        ) : (
          <input
            autoFocus={
              bodyweight && set.weightLb === null && prev?.weightLb == null
            }
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => {
              e.target.select();
              setFocus("w");
            }}
            onBlur={() => {
              setFocus(null);
              if (num(weight) !== set.weightLb) save({ weightLb: num(weight) });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                repsBox.current?.focus();
              }
            }}
            inputMode="decimal"
            enterKeyHint="next"
            placeholder={
              ghostW !== null ? String(ghostW) : bodyweight ? "+ lb" : "lb"
            }
            aria-label={`Set ${index + 1} weight`}
            className={field}
          />
        )}
        <input
          ref={repsBox}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onFocus={(e) => {
            e.target.select();
            setFocus("r");
          }}
          onBlur={() => {
            setFocus(null);
            if (num(reps) !== set.reps)
              save({
                reps: num(reps) === null ? null : Math.round(num(reps)!),
              });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          inputMode="numeric"
          enterKeyHint="done"
          placeholder={ghostR !== null ? String(ghostR) : "reps"}
          aria-label={`Set ${index + 1} reps`}
          className={field}
        />
        <button
          type="button"
          data-silent
          aria-label={
            done
              ? "Not done"
              : ghostW !== null && !weight && !reps
                ? "Done, same as last set"
                : "Done"
          }
          onClick={toggleDone}
          className={cx(
            "flex h-11 items-center justify-center rounded-xl border-2 text-lg font-bold transition active:scale-90",
            done
              ? "check-ring-done border-transparent text-white"
              : "border-line text-faint",
          )}
          style={
            done
              ? { backgroundColor: FIRE, boxShadow: `0 0 14px -2px ${FIRE}` }
              : undefined
          }
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
      {focus && (
        <div
          className="mt-1.5 grid grid-cols-4 gap-1.5 pl-8"
          aria-label={focus === "w" ? "Change weight" : "Change reps"}
        >
          {NUDGE[focus].map((by) => (
            <button
              key={by}
              type="button"
              // Keep the box focused (and the keyboard up) while nudging.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => nudge(focus, by)}
              className="rounded-lg border border-line bg-raised py-2 text-sm font-semibold tabular-nums text-ink active:scale-95"
              style={
                by > 0 ? { borderColor: `${FIRE}66`, color: FIRE } : undefined
              }
            >
              {by > 0 ? `+${by}` : `−${-by}`}
            </button>
          ))}
        </div>
      )}
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
  const mins = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 60000),
  );
  const allSets = blocks.flatMap((b) => b.sets);
  const doneSets = allSets.filter((s) => s.done).length;
  const inWorkout = useMemo(
    () => new Set(blocks.map((b) => b.exerciseId)),
    [blocks],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header: time, progress, Finish */}
      <div
        className="sticky top-2 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-surface/95 px-4 py-3 backdrop-blur"
        style={{ borderColor: `${FIRE}55` }}
      >
        <div className="min-w-0">
          <p
            className="truncate text-xs font-semibold tracking-[0.16em] uppercase"
            style={{ color: FIRE }}
          >
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
              const pr = r.records.length
                ? ` · 🏆 ${r.records.length} PR${r.records.length === 1 ? "" : "s"}: ${r.records.map((x) => x.name).join(", ")}`
                : "";
              sheet.toast(
                `Workout done ✓ ${r.volume.toLocaleString()} lb${pr}`,
              );
            })
          }
          className="glow-gym shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-95"
          style={{ backgroundColor: FIRE }}
        >
          Finish
        </button>
      </div>

      {blocks.length > 0 && doneSets === 0 && (
        <p className="px-1 text-xs text-muted">
          Weights are from last time. Change a number if needed, then tap ✓
          after each set. A rest timer starts.
        </p>
      )}

      {blocks.map((b) => {
        const done = b.sets.filter((s) => s.done).length;
        return (
          <section
            key={b.exerciseId}
            className="min-w-0 rounded-3xl border border-line bg-surface/85 p-3.5 shadow-card"
          >
            <div className="mb-2 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{b.name}</h3>
                <p className="truncate text-xs text-faint">
                  {partLabel(b)}
                  {b.last ? ` · Last: ${b.last}` : ""}
                </p>
              </div>
              <span
                className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums"
                style={{
                  color: done === b.sets.length && done > 0 ? FIRE : undefined,
                }}
              >
                {done}/{b.sets.length}
              </span>
              <button
                type="button"
                aria-label={`Remove ${b.name}`}
                onClick={() =>
                  window.confirm(`Take ${b.name} out of this workout?`) &&
                  startTransition(async () => {
                    const r = await removeExerciseAction(
                      workoutId,
                      b.exerciseId,
                    );
                    if (!r.ok) sheet.toast(r.error);
                  })
                }
                className="-mt-1 -mr-1 shrink-0 rounded-lg px-2 py-1 text-sm text-faint hover:text-danger"
              >
                ✕
              </button>
            </div>
            <div
              className={cx(
                ROW,
                "mb-1 text-center text-[10px] tracking-wider text-faint uppercase",
              )}
            >
              <span>Set</span>
              <span>Lb</span>
              <span>Reps</span>
              <span />
              <span />
            </div>
            <div className="flex flex-col gap-1">
              {b.sets.map((s, i) => (
                <SetRow
                  key={s.id}
                  set={s}
                  index={i}
                  prev={b.sets[i - 1]}
                  bodyweight={b.bodyweight}
                  onDone={() =>
                    setRestUntil(Date.now() + restLength.current * 1000)
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  const lastSet = b.sets[b.sets.length - 1];
                  await addSetAction(
                    workoutId,
                    b.exerciseId,
                    lastSet?.weightLb ?? null,
                    lastSet?.reps ?? null,
                  );
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
            restLength.current = Math.min(
              300,
              Math.max(30, restLength.current + s),
            );
            setRestUntil((u) =>
              Math.max(Date.now() + 5000, (u ?? Date.now()) + s * 1000),
            );
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
export function SplitCard({
  split,
  next,
  lastDone,
}: {
  split: string[];
  next: number;
  lastDone: Record<string, string>;
}) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const day = split[next];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-xs font-medium tracking-[0.16em] uppercase"
            style={{ color: FIRE }}
          >
            Up next
          </p>
          <p className="font-display text-3xl leading-tight font-semibold">
            {day}
          </p>
          <p className="text-xs text-muted">
            {lastDone[day] ? `Last time: ${lastDone[day]}` : "Not trained yet"}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await skipDayAction();
              sheet.toast(
                r.ok ? `⏭️ Skipped ${r.skipped}. Next up: ${r.next}` : r.error,
              );
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
              "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold whitespace-nowrap transition",
              i === next
                ? "text-white"
                : "border-line text-muted hover:text-ink",
            )}
            style={
              i === next
                ? { backgroundColor: FIRE, borderColor: FIRE }
                : undefined
            }
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
        Already done? Say it all at once: “{day.toLowerCase()} day, bench 3x10
        at 135, incline 3 sets of 8 at 50”. Or “skip {day.toLowerCase()} day”.
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
