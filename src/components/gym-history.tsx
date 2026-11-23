"use client";

/**
 * Past workouts on the Gym page: each one as a clean note (tap to open, copy
 * or delete), and fixing its sets by hand with the Edit button.
 */
import { useState, useTransition } from "react";
import { addSetAction, deleteSetAction, discardWorkoutAction, updateSetAction } from "@/app/(app)/gym/actions";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

const FIRE = "#ff6b4a";

/** One past workout as a clean note; tap to open, copy or delete it. */
export function WorkoutNoteCard({
  id,
  date,
  day,
  skipped,
  lines,
  exercises,
  meta,
  note,
}: {
  id: string;
  date: string;
  day: string | null;
  skipped: boolean;
  lines: { name: string; sets: string }[];
  exercises: PastExercise[];
  meta: string;
  note: string;
}) {
  const sheet = useTaskSheet();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate font-semibold">
            {day ? (
              <span
                className="mr-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white"
                style={{ backgroundColor: FIRE }}
              >
                {day}
              </span>
            ) : null}
            {date}
          </p>
          <p className="shrink-0 text-xs text-faint tabular-nums">{meta}</p>
        </div>
        <ul
          className={cx(
            "mt-1.5 flex flex-col gap-0.5 text-sm",
            !open && "max-h-[4.5rem] overflow-hidden",
          )}
        >
          {lines.map((l) => (
            <li
              key={l.name}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 truncate text-muted">{l.name}</span>
              <span className="shrink-0 font-display text-xs font-semibold tabular-nums">
                {l.sets}
              </span>
            </li>
          ))}
        </ul>
        {!open && lines.length > 3 && (
          <p className="mt-1 text-[11px] text-faint">
            +{lines.length - 3} more · tap to open
          </p>
        )}
      </button>
      {open && editing && (
        <EditPastWorkout
          workoutId={id}
          exercises={exercises}
          onDone={() => setEditing(false)}
        />
      )}
      {open && !editing && (
        <div className="fade-in flex gap-2 border-t border-line px-4 py-2.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: FIRE }}
          >
            ✏️ Edit
          </button>
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

export type PastExercise = {
  exerciseId: string;
  name: string;
  bodyweight: boolean;
  sets: { id: string; weightLb: number | null; reps: number | null }[];
};

/**
 * Fix a workout after the fact ("I actually did 12 reps, not 10"): every set
 * is a weight box and a reps box that save when you leave them, plus
 * "+ Set" and ✕ per set.
 */
function EditPastWorkout({
  workoutId,
  exercises,
  onDone,
}: {
  workoutId: string;
  exercises: PastExercise[];
  onDone: () => void;
}) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const run = (
    job: () => Promise<{ ok: true } | { ok: false; error: string }>,
    ok?: string,
  ) =>
    startTransition(async () => {
      const r = await job();
      if (!r.ok) sheet.toast(r.error);
      else if (ok) sheet.toast(ok);
    });
  const save = (
    setId: string,
    field: "weightLb" | "reps",
    raw: string,
    was: number | null,
  ) => {
    const v = raw.trim() === "" ? null : Number(raw);
    if (v !== null && (!Number.isFinite(v) || v < 0))
      return sheet.toast("Check the number");
    if (v === was) return;
    run(
      () =>
        updateSetAction(
          setId,
          field === "reps"
            ? { reps: v === null ? null : Math.round(v) }
            : { weightLb: v },
        ),
      "Fixed ✓",
    );
  };
  const box =
    "w-full min-w-0 rounded-xl border border-line bg-raised px-2 py-2 text-center font-display text-base font-semibold tabular-nums focus:border-[#ff6b4a] focus:outline-none";
  return (
    <div className="fade-in flex flex-col gap-3 border-t border-line px-4 py-3">
      {exercises.map((e) => (
        <div key={e.exerciseId || e.name}>
          <p className="mb-1.5 text-sm font-semibold">{e.name}</p>
          <div className="mb-1 grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 text-[11px] text-faint">
            <span />
            <span className="text-center">lb</span>
            <span className="text-center">reps</span>
            <span />
          </div>
          <ul className="flex flex-col gap-1.5">
            {e.sets.map((s, i) => (
              <li
                key={s.id}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
              >
                <span className="text-center text-xs text-faint tabular-nums">
                  {i + 1}
                </span>
                <input
                  defaultValue={s.weightLb ?? ""}
                  placeholder={e.bodyweight ? "BW" : "lb"}
                  inputMode="decimal"
                  aria-label={`${e.name} set ${i + 1} weight`}
                  onFocus={(ev) => ev.currentTarget.select()}
                  onBlur={(ev) =>
                    save(s.id, "weightLb", ev.currentTarget.value, s.weightLb)
                  }
                  className={box}
                />
                <input
                  defaultValue={s.reps ?? ""}
                  inputMode="numeric"
                  aria-label={`${e.name} set ${i + 1} reps`}
                  onFocus={(ev) => ev.currentTarget.select()}
                  onBlur={(ev) =>
                    save(s.id, "reps", ev.currentTarget.value, s.reps)
                  }
                  className={box}
                />
                <button
                  type="button"
                  aria-label={`Remove set ${i + 1}`}
                  disabled={pending}
                  onClick={() =>
                    run(() => deleteSetAction(s.id), "Set removed")
                  }
                  className="flex size-8 items-center justify-center rounded-full text-faint hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          {e.exerciseId && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const last = e.sets[e.sets.length - 1];
                run(
                  () =>
                    addSetAction(
                      workoutId,
                      e.exerciseId,
                      last?.weightLb ?? null,
                      last?.reps ?? null,
                      true,
                    ),
                  "Set added",
                );
              }}
              className="mt-1.5 rounded-lg border border-dashed border-line px-3 py-1 text-xs font-semibold text-muted"
            >
              + Set
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onDone}
        className="self-end rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: FIRE }}
      >
        Done
      </button>
    </div>
  );
}
