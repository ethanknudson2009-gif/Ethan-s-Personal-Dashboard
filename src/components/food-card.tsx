"use client";

/** Today's food: a calorie bar toward your goal, what you ate, and quick add. */
import { useState, useTransition } from "react";
import { deleteFoodAction, logFoodAction, setCalorieGoalAction } from "@/app/(app)/life/actions";
import { cx, inputClass } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

const FOOD = "#ffb547";

export type FoodRow = { id: string; name: string; calories: number | null; proteinG: number | null };

export function FoodCard({ rows, goal, weekAvg }: { rows: FoodRow[]; goal: number | null; weekAvg: number | null }) {
  const sheet = useTaskSheet();
  const [pending, startTransition] = useTransition();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState(goal?.toString() ?? "");
  const total = rows.reduce((n, r) => n + (r.calories ?? 0), 0);
  const protein = rows.reduce((n, r) => n + (r.proteinG ?? 0), 0);
  const pct = goal ? Math.min(100, Math.round((total / goal) * 100)) : 0;
  const over = goal !== null && total > goal;

  return (
    <section className="rounded-3xl border bg-surface/85 p-4 shadow-card" style={{ borderColor: `${FOOD}44` }}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: FOOD }}>
          🍽️ Food today
        </h2>
        <button type="button" onClick={() => setEditingGoal((v) => !v)} className="text-xs text-muted hover:text-ink">
          {goal ? `Goal ${goal.toLocaleString()}` : "Set a goal"}
        </button>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <p className="font-display text-3xl font-semibold tabular-nums">{total.toLocaleString()}</p>
        <p className="pb-1 text-sm text-muted">
          cal{protein ? ` · ${protein}g protein` : ""}
          {goal ? (over ? ` · ${(total - goal).toLocaleString()} over` : ` · ${(goal - total).toLocaleString()} left`) : ""}
        </p>
      </div>
      {goal !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-raised">
          <div className="bar-grow h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: over ? "var(--color-danger)" : FOOD }} />
        </div>
      )}

      {editingGoal && (
        <form
          className="fade-in mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const g = goalText.trim() ? Number(goalText) : null;
            startTransition(async () => {
              const r = await setCalorieGoalAction(g);
              if (!r.ok) return sheet.toast(r.error);
              setEditingGoal(false);
            });
          }}
        >
          <input value={goalText} onChange={(e) => setGoalText(e.target.value)} inputMode="numeric" placeholder="e.g. 2400 (empty = none)" className={cx(inputClass, "flex-1")} />
          <button type="submit" disabled={pending} className="rounded-xl px-3 text-sm font-semibold text-black" style={{ backgroundColor: FOOD }}>
            Save
          </button>
        </form>
      )}

      {rows.length > 0 ? (
        <ul className="rows mt-3 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-xl bg-raised/60 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="shrink-0 text-xs text-muted tabular-nums">
                {r.calories !== null ? `${r.calories} cal` : "? cal"}
                {r.proteinG ? ` · ${r.proteinG}g` : ""}
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteFoodAction(r.id);
                    if (!res.ok) return sheet.toast(res.error);
                    sheet.toast(`Removed ${r.name}`, {
                      label: "Undo",
                      run: () => void logFoodAction({ name: r.name, calories: r.calories, proteinG: r.proteinG }),
                    });
                  })
                }
                className="shrink-0 px-1 text-xs text-faint hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing yet. Tap + and say “ate a chicken burrito 700 calories”.</p>
      )}
      {weekAvg !== null && <p className="mt-3 text-xs text-faint">7-day average: {weekAvg.toLocaleString()} cal/day</p>}
    </section>
  );
}
