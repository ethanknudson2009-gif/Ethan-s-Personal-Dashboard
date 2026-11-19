"use client";

/**
 * Week view: each day with its classes (and times), what's due, and any
 * workout you logged.
 * Phone: a compact list. Days already past this week fold away under
 * "Earlier this week" so today is on top; free days take one line.
 * Laptop: 7 columns; drag a task onto another day to move it.
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
  classes: { id: string; name: string; color: string; starts_at: string; ends_at?: string }[];
  tasks: TaskView[];
  /** Workouts logged that day, e.g. "Chest" or "Skipped Legs". */
  gym?: string[];
};

const TONE_EDGE: Record<TaskView["tone"], string> = {
  overdue: "border-danger/60 shadow-glow-danger",
  today: "border-accent/60 shadow-glow",
  tomorrow: "border-warn/50",
  normal: "border-line",
  done: "border-line opacity-50 line-through",
};

/** "8:00 AM" → "8", "12:30 PM" → "12:30" — short times for a busy row. */
const shortTime = (t: string) => formatTimeOfDay(t).replace(":00", "").replace(/\s?(AM|PM)$/, "");

export function CalendarWeek({ days }: { days: WeekDay[] }) {
  const sheet = useTaskSheet();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [, startTransition] = useTransition();

  const allTasks = new Map(days.flatMap((d) => d.tasks.map((t) => [t.id, t] as const)));
  const hasToday = days.some((d) => d.isToday);
  // Past days that still have something open stay visible (overdue work shouldn't hide).
  const earlier = hasToday ? days.filter((d) => d.isPast && !d.tasks.some((t) => !t.done)) : [];

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
      {earlier.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEarlier((v) => !v)}
          className="rounded-xl border border-dashed border-line px-3 py-2 text-left text-xs text-muted lg:hidden"
        >
          {showEarlier ? "▾ Hide" : "▸ Show"} earlier this week ({earlier.map((d) => d.weekday).join(", ")})
        </button>
      )}
      {days.map((day) => {
        const folded = earlier.includes(day) && !showEarlier;
        const empty = day.tasks.length === 0 && day.classes.length === 0 && !(day.gym ?? []).length;
        const open = day.tasks.filter((t) => !t.done).length;
        return (
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
              "flex-col gap-2 rounded-2xl border transition lg:flex lg:min-h-64 lg:p-3",
              folded ? "hidden lg:flex" : "flex",
              empty ? "px-3 py-2 lg:py-3" : "p-3",
              day.isToday ? "border-accent/50 bg-accent/5 shadow-glow" : "border-line bg-surface/80",
              day.isPast && !day.isToday && "opacity-60",
              overDate === day.date && "border-accent bg-accent/15",
            )}
          >
            <header className="flex items-baseline gap-2 lg:flex-col lg:gap-0">
              <span className={cx("w-9 text-xs font-semibold tracking-[0.14em] uppercase lg:w-auto", day.isToday ? "text-accent" : "text-muted")}>
                {day.weekday}
              </span>
              <span className={cx("font-display text-xl font-semibold", day.isToday && "text-accent")}>{day.dayNumber}</span>
              {day.isToday && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold text-accent-ink lg:hidden">TODAY</span>}
              <span className="ml-auto text-xs text-faint lg:ml-0">
                {empty ? "Free" : open ? `${open} due` : day.tasks.length ? "All done ✓" : ""}
              </span>
            </header>

            {/* Classes: one compact line each, time first */}
            {day.classes.length > 0 && (
              <ul className="flex flex-col gap-1">
                {day.classes.map((c) => (
                  <li key={c.id} className="flex min-w-0 items-center gap-2 text-xs text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="w-16 shrink-0 tabular-nums text-faint lg:hidden">
                      {shortTime(c.starts_at)}
                      {c.ends_at ? `–${shortTime(c.ends_at)}` : ""}
                    </span>
                    <span className="min-w-0 truncate">{c.name}</span>
                  </li>
                ))}
              </ul>
            )}

            {(day.gym ?? []).length > 0 && (
              <p className="flex flex-wrap gap-1 text-xs">
                {(day.gym ?? []).map((g) => (
                  <span key={g} className="rounded-md bg-[#ff6b4a]/15 px-1.5 py-0.5 font-semibold text-[#ff6b4a]">
                    {g.startsWith("Skipped") ? `⏭️ ${g}` : `🏋️ ${g}`}
                  </span>
                ))}
              </p>
            )}

            {day.tasks.length > 0 && (
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
                        "flex w-full cursor-grab items-baseline gap-2 overflow-hidden rounded-xl border bg-raised px-2.5 py-2 text-left text-sm font-medium break-words transition hover:border-accent/60 active:cursor-grabbing lg:text-xs",
                        TONE_EDGE[t.tone],
                        dragId === t.id && "opacity-40",
                      )}
                      style={t.classColor ? { borderLeftColor: t.classColor, borderLeftWidth: 3 } : undefined}
                    >
                      <span className="min-w-0 flex-1">{t.displayTitle}</span>
                      {t.edit.dueTime && <span className="shrink-0 text-[11px] text-faint">{shortTime(t.edit.dueTime)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
