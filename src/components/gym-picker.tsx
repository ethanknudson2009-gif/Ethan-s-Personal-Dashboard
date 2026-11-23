"use client";

/**
 * The exercise picker: search by name or nickname, or browse the muscle tree
 * (Arms → Biceps, Triceps, Forearms…). Also the small helpers that file an
 * exercise under its group and part.
 */
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { addExerciseAction, createExerciseAction } from "@/app/(app)/gym/actions";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";
import { DETAIL_LABELS, MUSCLE_LABELS, MUSCLE_TREE, detailOf, groupOf, searchScore, type Detail, type Muscle } from "@/lib/exercise-library";
import type { ExerciseOption } from "@/components/gym-parts";

const FIRE = "#ff6b4a";

const muscleLabel = (m: string) =>
  MUSCLE_LABELS[m as Muscle] ?? m.charAt(0).toUpperCase() + m.slice(1);

/** The exact muscle (Hamstrings, Side delts…), or null for your own "other" exercises. */
const partOf = (e: { name: string; muscle: string }): Detail | null =>
  e.muscle in MUSCLE_LABELS
    ? detailOf(e.name, e.muscle)
    : e.muscle === "arms"
      ? "biceps"
      : null;
export const partLabel = (e: { name: string; muscle: string }) => {
  const p = partOf(e);
  return p ? DETAIL_LABELS[p] : muscleLabel(e.muscle);
};
/** Which top group (Chest, Arms, Legs…) an exercise is filed under in the picker. */
const groupKeyOf = (e: { name: string; muscle: string }) => {
  const p = partOf(e);
  return p ? groupOf(p).key : "other";
};

/** The muscle saved for a new exercise made while a group (and maybe a part) is picked. */
function muscleFor(group: string, part: Detail | null): string {
  if (part === "biceps" || part === "triceps" || part === "forearms")
    return part;
  if (part) return groupOf(part).key;
  return group === "arms" ? "biceps" : group;
}

/**
 * Pick exercises: search by name or nickname ("rdl", "pec deck"), or browse
 * by muscle. Tap to add; it stays open so you can add several, then Done.
 */
export function ExercisePicker({
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
  const [tab, setTab] = useState<string>(
    hasDay ? "day" : exercises.some((e) => e.recent) ? "recent" : "chest",
  );
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  // Muscles as a tree: tap a group (Legs), then a part (Hamstrings) if you want.
  const [part, setPart] = useState<Detail | null>(null);
  const groups = useMemo(() => {
    const tree = MUSCLE_TREE.filter((g) =>
      exercises.some((e) => groupKeyOf(e) === g.key),
    ).map((g) => ({
      key: g.key,
      label: g.label,
      parts: g.parts.filter((p) => exercises.some((e) => partOf(e) === p)),
    }));
    return exercises.some((e) => groupKeyOf(e) === "other")
      ? [...tree, { key: "other", label: "Other", parts: [] as Detail[] }]
      : tree;
  }, [exercises]);
  const current = groups.find((g) => g.key === tab);

  const list = useMemo(() => {
    if (q.trim()) {
      return exercises
        .map((e) => ({
          e,
          s: searchScore(q, e.name, e.aliases) + (e.recent ? 3 : 0),
        }))
        .filter((x) => x.s > 3 || (x.s > 0 && !x.e.recent))
        .sort((a, b) => b.s - a.s)
        .slice(0, 40)
        .map((x) => x.e);
    }
    const pick =
      tab === "day"
        ? exercises.filter((e) => dayMuscles.includes(e.muscle))
        : tab === "recent"
          ? exercises.filter((e) => e.recent)
          : exercises.filter(
              (e) => groupKeyOf(e) === tab && (!part || partOf(e) === part),
            );
    // Ones you've done before first, then the most common ones.
    return [...pick].sort(
      (a, b) =>
        Number(b.recent) - Number(a.recent) ||
        a.rank - b.rank ||
        a.name.localeCompare(b.name),
    );
  }, [q, tab, part, exercises, dayMuscles]);

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
    ...(exercises.some((e) => e.recent)
      ? [{ key: "recent", label: "⭐ Done before" }]
      : []),
    ...groups.map((g) => ({ key: g.key, label: g.label })),
  ];

  // Drawn on top of the whole app (not inside the page, whose slide animation
  // would trap a full-screen layer and let the bottom bar cover it).
  const onClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!onClient) return null;
  return createPortal(
    <div
      className="fade-in fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur"
      role="dialog"
      aria-label="Add exercises"
    >
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
                onClick={() => {
                  setTab(t.key);
                  setPart(null);
                }}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-2 text-sm whitespace-nowrap transition",
                  tab === t.key
                    ? "border-transparent font-semibold text-white"
                    : "border-line bg-raised text-muted",
                )}
                style={tab === t.key ? { backgroundColor: FIRE } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* The second level of the tree: only the parts of the group you tapped. */}
        {!q && current && current.parts.length > 1 && (
          <div
            key={tab}
            className="sheet-down -mx-4 -mt-1 flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
          >
            {[null, ...current.parts].map((p) => (
              <button
                key={p ?? "all"}
                type="button"
                onClick={() => setPart(p)}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-2 text-xs whitespace-nowrap transition",
                  part === p
                    ? "font-semibold"
                    : "border-line bg-surface text-muted",
                )}
                style={
                  part === p
                    ? {
                        borderColor: FIRE,
                        color: FIRE,
                        backgroundColor: "rgb(255 107 74 / 0.1)",
                      }
                    : undefined
                }
              >
                {p ? DETAIL_LABELS[p] : `All ${current.label.toLowerCase()}`}
              </button>
            ))}
          </div>
        )}

        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {list.length === 0 && (
            <li className="py-6 text-center text-sm text-muted">
              {q ? "Not in the list. Add it below." : "Nothing here yet."}
            </li>
          )}
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
                      {partLabel(e)}
                      {e.equipment ? ` · ${e.equipment}` : ""}
                    </span>
                  </span>
                  <span
                    className={cx(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border text-base font-bold",
                      isIn
                        ? "border-transparent text-white"
                        : "border-line text-muted",
                    )}
                    style={isIn ? { backgroundColor: FIRE } : undefined}
                  >
                    {isIn ? "✓" : "+"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {q.trim() &&
          !exercises.some(
            (e) => e.name.toLowerCase() === q.trim().toLowerCase(),
          ) && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const muscle =
                    tab === "day" || tab === "recent"
                      ? (dayMuscles[0] ?? "other")
                      : muscleFor(tab, part);
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
    </div>,
    document.body,
  );
}
