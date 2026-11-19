"use client";

/** Interactive pieces of the Gym page: the live workout, sets, picker and rest timer. */
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  addExerciseAction,
  addSetAction,
  createExerciseAction,
  deleteSetAction,
  discardWorkoutAction,
  finishWorkoutAction,
  setNextDayAction,
  skipDayAction,
  startWorkoutAction,
  updateSetAction,
} from "@/app/(app)/gym/actions";
import { Button, Chip, cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

const FIRE = "#ff6b4a";

export type ExerciseOption = { id: string; name: string; muscle: string; recent: boolean };
export type SetRowData = { id: string; weightLb: number | null; reps: number | null; done: boolean };
export type Block = { exerciseId: string; name: string; last: string | null; sets: SetRowData[] };

export function StartWorkout({ label = "Start workout" }: { label?: string }) {
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
      className="glow-gym w-full rounded-2xl px-4 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      style={{ backgroundColor: FIRE }}
    >
      {pending ? "Starting…" : `🏋️ ${label}`}
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
    <div className="fade-in fixed bottom-28 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-surface/95 py-2 pr-2 pl-4 shadow-card backdrop-blur md:bottom-8" style={{ borderColor: `${FIRE}88`, boxShadow: `0 0 24px -6px ${FIRE}` }}>
      <span className="text-sm font-semibold">Rest</span>
      <span className="font-display text-xl font-semibold tabular-nums" style={{ color: FIRE }}>
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
      </span>
      <button type="button" onClick={() => onAdd(30)} className="rounded-full bg-raised px-2.5 py-1 text-xs font-semibold">
        +30s
      </button>
      <button type="button" onClick={onDone} className="rounded-full px-2.5 py-1 text-xs text-muted">
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
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const save = (patch: Parameters<typeof updateSetAction>[1]) =>
    startTransition(async () => {
      const r = await updateSetAction(set.id, patch);
      if (!r.ok) sheet.toast(r.error);
    });
  return (
    <div className={cx("grid grid-cols-[2rem_1fr_1fr_3rem_1.5rem] items-center gap-2 rounded-xl px-1 py-1 transition", done && "bg-[#ff6b4a]/10")}>
      <span className="text-center text-xs font-semibold text-muted">{index + 1}</span>
      <input
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => num(weight) !== set.weightLb && save({ weightLb: num(weight) })}
        inputMode="decimal"
        placeholder="lb"
        aria-label={`Set ${index + 1} weight`}
        className={cx(inputClass, "py-2 text-center")}
      />
      <input
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => num(reps) !== set.reps && save({ reps: num(reps) === null ? null : Math.round(num(reps)!) })}
        inputMode="numeric"
        placeholder="reps"
        aria-label={`Set ${index + 1} reps`}
        className={cx(inputClass, "py-2 text-center")}
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
          "flex h-10 items-center justify-center rounded-xl border-2 text-lg font-bold transition active:scale-90",
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
        className="text-xs text-faint hover:text-danger"
      >
        ✕
      </button>
    </div>
  );
}

function ExercisePicker({ workoutId, exercises, onClose }: { workoutId: string; exercises: ExerciseOption[]; onClose: () => void }) {
  const sheet = useTaskSheet();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string>("recent");
  const [pending, startTransition] = useTransition();
  const muscles = useMemo(() => ["recent", ...Array.from(new Set(exercises.map((e) => e.muscle)))], [exercises]);
  const list = exercises.filter((e) =>
    q ? e.name.toLowerCase().includes(q.toLowerCase()) : muscle === "recent" ? e.recent : e.muscle === muscle,
  );
  const add = (id: string) =>
    startTransition(async () => {
      const r = await addExerciseAction(workoutId, id);
      if (!r.ok) return sheet.toast(r.error);
      onClose();
    });
  return (
    <div className="fade-in flex flex-col gap-3 rounded-3xl border bg-surface/95 p-4" style={{ borderColor: `${FIRE}66` }}>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className={inputClass} />
      {!q && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {muscles.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {m === "recent" ? "⭐ Recent" : m[0].toUpperCase() + m.slice(1)}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {list.length === 0 && <p className="py-2 text-sm text-muted">{q ? "No match. Add it below." : muscle === "recent" ? "Nothing yet: pick a muscle group." : "None here."}</p>}
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            disabled={pending}
            onClick={() => add(e.id)}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-raised active:scale-[0.99]"
          >
            <span className="font-medium">{e.name}</span>
            <span className="text-xs text-faint">{e.muscle}</span>
          </button>
        ))}
      </div>
      {q.trim() && !exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await createExerciseAction(q, muscle === "recent" ? "other" : muscle);
              if (!r.ok) return sheet.toast(r.error);
              const r2 = await addExerciseAction(workoutId, r.id);
              if (!r2.ok) return sheet.toast(r2.error);
              onClose();
            })
          }
        >
          + Add “{q.trim()}” as a new exercise
        </Button>
      )}
      <Button type="button" variant="ghost" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

export function ActiveWorkout({ workoutId, startedAt, blocks, exercises }: { workoutId: string; startedAt: string; blocks: Block[]; exercises: ExerciseOption[] }) {
  const sheet = useTaskSheet();
  const [picking, setPicking] = useState(blocks.length === 0);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  const doneSets = blocks.reduce((n, b) => n + b.sets.filter((s) => s.done).length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border bg-surface/80 px-4 py-3" style={{ borderColor: `${FIRE}55` }}>
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: FIRE }}>
            ● Live workout
          </p>
          <p className="font-display text-xl font-semibold tabular-nums">
            {mins} min · {doneSets} set{doneSets === 1 ? "" : "s"}
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
          className="glow-gym rounded-xl px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
          style={{ backgroundColor: FIRE }}
        >
          Finish
        </button>
      </div>

      {blocks.map((b) => (
        <section key={b.exerciseId} className="rounded-3xl border border-line bg-surface/85 p-4 shadow-card">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="font-semibold">{b.name}</h3>
            {b.last && <span className="truncate text-xs text-faint">Last: {b.last}</span>}
          </div>
          <div className="mb-1 grid grid-cols-[2rem_1fr_1fr_3rem_1.5rem] gap-2 px-1 text-center text-[10px] tracking-wider text-faint uppercase">
            <span>Set</span>
            <span>Lb</span>
            <span>Reps</span>
            <span />
            <span />
          </div>
          <div className="flex flex-col gap-1">
            {b.sets.map((s, i) => (
              <SetRow key={s.id} set={s} index={i} onDone={() => setRestUntil(Date.now() + 90_000)} />
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
            className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-xs font-semibold text-muted hover:text-ink"
          >
            + Set
          </button>
        </section>
      ))}

      {picking ? (
        <ExercisePicker workoutId={workoutId} exercises={exercises} onClose={() => setPicking(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="rounded-2xl border border-dashed px-4 py-3 text-sm font-semibold transition hover:bg-[#ff6b4a]/10"
          style={{ borderColor: `${FIRE}88`, color: FIRE }}
        >
          + Add exercise
        </button>
      )}

      <button
        type="button"
        onClick={() =>
          window.confirm("Throw away this workout?") &&
          startTransition(async () => {
            await discardWorkoutAction(workoutId);
          })
        }
        className="self-center text-xs text-faint hover:text-danger"
      >
        Discard workout
      </button>

      {restUntil && <RestTimer until={restUntil} onDone={() => setRestUntil(null)} onAdd={(s) => setRestUntil((u) => (u ?? Date.now()) + s * 1000)} />}
    </div>
  );
}

/**
 * Your split: which day is up, the whole rotation (tap a day to do that one
 * instead), Skip, and a mic button to say the whole workout at once.
 */
export function SplitCard({ split, next, lastDone }: { split: string[]; next: number; lastDone: Record<string, string> }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const day = split[next];
  return (
    <div className="flex flex-col gap-3">
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

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => sheet.openVoice()}
          className="rounded-2xl border px-3 py-3 text-sm font-semibold transition active:scale-[0.98]"
          style={{ borderColor: `${FIRE}88`, color: FIRE }}
        >
          🎤 Say your workout
        </button>
        <StartWorkout label="Log live" />
      </div>
      <p className="text-[11px] leading-snug text-faint">
        Say it all at once, any order: “{day.toLowerCase()} day, bench 3x10 at 135, incline 3 sets of 8 at 50, flys 3x12 at 30”. Or “skip {day.toLowerCase()} day”.
      </p>
    </div>
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
