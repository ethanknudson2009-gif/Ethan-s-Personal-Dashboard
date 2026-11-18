"use client";

/**
 * One habit: a big glowing check for today, the streak flame, a strength
 * ring, and this week's dots (tap any past day to fix it).
 */
import { useOptimistic, useState, useTransition } from "react";
import { deleteHabitAction, toggleCheckinAction } from "@/app/(app)/life/actions";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

export type HabitCardData = {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
  targetText: string;
  strength: number;
  streak: number;
  streakUnit: "day" | "week";
  weekProgress: string | null; // "2/3 this week" for weekly habits
  today: string;
  days: { date: string; label: string; checked: boolean; future: boolean }[]; // this week, Mon–Sun
};

export function HabitCard({ habit }: { habit: HabitCardData }) {
  const sheet = useTaskSheet();
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(new Set(habit.days.filter((d) => d.checked).map((d) => d.date)));
  const [burst, setBurst] = useState(0);
  const doneToday = checked.has(habit.today);

  function toggle(date: string) {
    const willCheck = !checked.has(date);
    if (willCheck && date === habit.today) setBurst((b) => b + 1);
    startTransition(async () => {
      const next = new Set(checked);
      if (willCheck) next.add(date);
      else next.delete(date);
      setChecked(next);
      const r = await toggleCheckinAction(habit.id, date);
      if (!r.ok) sheet.toast(`Couldn't save: ${r.error}`);
      else if (willCheck && date === habit.today) sheet.toast(`${habit.emoji ?? "✓"} ${habit.name} done${habit.streak > 0 ? ` · 🔥 keep it going` : ""}`);
    });
  }

  const size = 54;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;

  return (
    <li
      className={cx(
        "relative flex flex-col gap-3 rounded-3xl border bg-raised/70 p-4 transition",
        doneToday ? "border-transparent" : "border-line",
      )}
      style={doneToday ? { boxShadow: `0 0 0 1px ${habit.color}88, 0 0 24px -6px ${habit.color}` } : undefined}
    >
      <div className="flex items-center gap-3">
        {/* Today's big check */}
        <button
          type="button"
          onClick={() => toggle(habit.today)}
          aria-label={doneToday ? `Undo ${habit.name} today` : `Done ${habit.name} today`}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
          style={{ backgroundColor: doneToday ? habit.color : "transparent", border: `2px solid ${habit.color}`, color: doneToday ? "#04221d" : habit.color }}
        >
          {burst > 0 && <span key={burst} className="check-burst absolute inset-0 rounded-2xl" style={{ backgroundColor: habit.color }} />}
          <span className="text-xl">{doneToday ? "✓" : (habit.emoji ?? "○")}</span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {habit.emoji && doneToday ? `${habit.emoji} ` : ""}
            {habit.name}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span>{habit.targetText}</span>
            {habit.weekProgress && <span className="text-ink">{habit.weekProgress}</span>}
            {habit.streak > 0 && (
              <span className="font-semibold text-warn">
                🔥 {habit.streak} {habit.streakUnit}
                {habit.streak === 1 ? "" : "s"}
              </span>
            )}
          </p>
        </div>

        {/* Strength ring */}
        <div className="relative shrink-0" style={{ width: size, height: size }} title="Habit strength">
          <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={5} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={habit.color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - habit.strength / 100)}
              className="ring-progress"
              style={{ filter: `drop-shadow(0 0 4px ${habit.color})` }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold">{habit.strength}%</span>
        </div>
      </div>

      {/* This week */}
      <div className="grid grid-cols-7 gap-1">
        {habit.days.map((d) => {
          const on = checked.has(d.date);
          return (
            <button
              key={d.date}
              type="button"
              disabled={d.future}
              onClick={() => toggle(d.date)}
              aria-label={`${d.label}: ${on ? "done" : "not done"}`}
              className="flex flex-col items-center gap-1 rounded-xl py-1 text-[10px] text-muted transition active:scale-90 disabled:opacity-30"
            >
              {d.label}
              <span
                className={cx("h-2.5 w-2.5 rounded-full border", d.date === habit.today && !on && "animate-pulse")}
                style={on ? { backgroundColor: habit.color, borderColor: habit.color, boxShadow: `0 0 8px ${habit.color}` } : { borderColor: "var(--color-line)" }}
              />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Delete the habit "${habit.name}"? (It stays in the Trash for 7 days.)`)) {
            startTransition(async () => {
              const r = await deleteHabitAction(habit.id);
              sheet.toast(r.ok ? "Habit deleted" : `Couldn't delete: ${r.error}`);
            });
          }
        }}
        className="absolute top-2 right-2 hidden rounded-lg px-2 text-xs text-faint hover:text-danger md:block"
        aria-label={`Delete ${habit.name}`}
      >
        ✕
      </button>
    </li>
  );
}
