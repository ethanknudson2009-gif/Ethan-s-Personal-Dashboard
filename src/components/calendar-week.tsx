"use client";

/**
 * Week view: each day with its classes and what's due.
 * Laptop: 7 columns; drag a task onto another day to move it.
 * Phone: a list of days; tap a task to edit it (and change its day).
 */
import { useState, useTransition } from "react";
import { saveTaskAction } from "@/app/(app)/tasks/actions";
import type { TaskView } from "@/lib/tasks/view";
import { formatTimeOfDay } from "@/lib/format";
import { cx } from "@/components/ui";
import { useTaskSheet } from "@/components/task-sheet";

export type WeekDay = {
  date: string;
  weekday: string; // "Mon"
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  classes: { id: string; name: string; color: string; starts_at: string }[];
  tasks: TaskView[];
};

const TONE_EDGE: Record<TaskView["tone"], string> = {
  overdue: "border-danger/60 shadow-glow-danger",
  today: "border-accent/60 shadow-glow",
  tomorrow: "border-warn/50",
  normal: "border-line",
  done: "border-line opacity-50 line-through",
};

export function CalendarWeek({ days }: { days: WeekDay[] }) {
  const sheet = useTaskSheet();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const allTasks = new Map(days.flatMap((d) => d.tasks.map((t) => [t.id, t] as const)));

  function moveTo(date: string) {
    const task = dragId ? allTasks.get(dragId) : undefined;
    setDragId(null);
    setOverDate(null);
    if (!task || task.edit.dueDate === date) return;
    startTransition(async () => {
      const result = await saveTaskAction({ ...task.edit, dueDate: date });
      sheet.toast(result.ok ? "Moved ✓" : `Couldn't move: ${result.error}`);
    });
  }

  return (
    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-7 lg:gap-2">
      {days.map((day) => (
        <section
          key={day.date}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setOverDate(day.date);
          }}
          onDragLeave={() => setOverDate((d) => (d === day.date ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            moveTo(day.date);
          }}
          className={cx(
            "flex flex-col gap-2 rounded-2xl border p-3 transition lg:min-h-64",
            day.isToday ? "border-accent/50 bg-accent/5 shadow-glow" : "border-line bg-surface/80",
            day.isPast && !day.isToday && "opacity-60",
            overDate === day.date && "border-accent bg-accent/15",
          )}
        >
          <header className="flex items-baseline gap-2 lg:flex-col lg:gap-0">
            <span className={cx("text-xs font-semibold tracking-[0.14em] uppercase", day.isToday ? "text-accent" : "text-muted")}>
              {day.weekday}
            </span>
            <span className={cx("font-display text-xl font-semibold", day.isToday && "text-accent")}>{day.dayNumber}</span>
          </header>

          {day.classes.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 lg:flex-col">
              {day.classes.map((c) => (
                <li key={c.id} className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg bg-raised/70 px-2 py-1 text-[11px] text-muted" title={formatTimeOfDay(c.starts_at)}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.name}</span>
                </li>
              ))}
            </ul>
          )}

          <ul className="flex flex-col gap-1.5">
            {day.tasks.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  draggable={!t.done}
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverDate(null);
                  }}
                  onClick={() => sheet.openEdit(t.edit)}
                  className={cx(
                    "w-full cursor-grab overflow-hidden rounded-xl border bg-raised px-2.5 py-2 text-left text-xs font-medium break-words transition hover:border-accent/60 active:cursor-grabbing",
                    TONE_EDGE[t.tone],
                    dragId === t.id && "opacity-40",
                  )}
                  style={t.classColor ? { borderLeftColor: t.classColor, borderLeftWidth: 3 } : undefined}
                >
                  {t.displayTitle}
                </button>
              </li>
            ))}
          </ul>
          {day.tasks.length === 0 && day.classes.length === 0 && <p className="text-xs text-faint">Free</p>}
        </section>
      ))}
    </div>
  );
}
