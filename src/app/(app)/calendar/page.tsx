import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { monthGrid, monthTitle, safeDate, shiftMonth, weekDays } from "@/lib/calendar";
import { formatLocalDate, formatTimeOfDay, WEEKDAY_SHORT } from "@/lib/format";
import { addDays, compareLocalDates, fromLocal, toLocalDate, weekdayOf } from "@/lib/time";
import { toTaskView, type TaskRecord, type TaskView } from "@/lib/tasks/view";
import { cx, PageHeader } from "@/components/ui";
import { AddButton } from "@/components/add-button";
import { TaskItem } from "@/components/task-item";
import { CalendarWeek, type WeekDay } from "@/components/calendar-week";
import { loadSchedule } from "../schedule-data";

/** Calendar: Week (default) and Month views of classes and what's due. */
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const view = params.view === "month" ? "month" : "week";

  const supabase = await createClient();
  const settings = await loadSettings(supabase);
  const { timeZone } = settings;
  const now = new Date();
  const today = toLocalDate(now, timeZone);
  const focus = safeDate(params.date, today);

  // The days on screen, then everything due inside them.
  const days = view === "week" ? weekDays(focus) : monthGrid(focus).map((d) => d.date);
  const first = days[0];
  const afterLast = addDays(days[days.length - 1], 1);

  const [taskRes, classRes, classesOn, gymRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, class_id, due_at, due_has_time, status, repeat")
      .is("deleted_at", null)
      .gte("due_at", fromLocal(first, { hour: 0, minute: 0 }, timeZone).toISOString())
      .lt("due_at", fromLocal(afterLast, { hour: 0, minute: 0 }, timeZone).toISOString())
      .order("due_at"),
    supabase.from("classes").select("id, name, color").is("deleted_at", null),
    loadSchedule(),
    supabase
      .from("workouts")
      .select("started_at, split_day, skipped, name")
      .is("deleted_at", null)
      .not("ended_at", "is", null)
      .gte("started_at", fromLocal(first, { hour: 0, minute: 0 }, timeZone).toISOString())
      .lt("started_at", fromLocal(afterLast, { hour: 0, minute: 0 }, timeZone).toISOString()),
  ]);
  // Workouts per day: "Chest", "Skipped Legs", or the cardio name.
  const gymByDay = new Map<string, string[]>();
  for (const w of gymRes.data ?? []) {
    const d = toLocalDate(new Date(w.started_at), timeZone);
    const label = w.skipped ? `Skipped ${w.split_day ?? "day"}` : (w.split_day ?? w.name ?? "Workout");
    gymByDay.set(d, [...(gymByDay.get(d) ?? []), label]);
  }

  const classById = new Map((classRes.data ?? []).map((c) => [c.id, c]));
  const byDay = new Map<string, TaskRecord[]>();
  for (const t of taskRes.data ?? []) {
    const d = toLocalDate(new Date(t.due_at!), timeZone);
    byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  const view_ = (t: TaskRecord) => toTaskView(t, t.class_id ? (classById.get(t.class_id) ?? null) : null, now, timeZone);

  const prev = view === "week" ? addDays(focus, -7) : shiftMonth(focus, -1);
  const next = view === "week" ? addDays(focus, 7) : shiftMonth(focus, 1);
  const title = view === "week" ? `Week of ${formatLocalDate(days[0]).split(", ")[1]}` : monthTitle(focus);
  const href = (v: string, d: string) => `/calendar?view=${v}&date=${d}`;

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title={title} subtitle="Calendar">
        <AddButton />
      </PageHeader>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(["week", "month"] as const).map((v) => (
            <Link
              key={v}
              href={href(v, focus)}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition",
                view === v ? "bg-accent/15 text-accent shadow-glow" : "text-muted hover:text-ink",
              )}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Link href={href(view, prev)} aria-label="Previous" className="rounded-lg px-3 py-1.5 text-lg text-muted hover:bg-raised hover:text-ink">
            ‹
          </Link>
          <Link href={href(view, today)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink">
            Today
          </Link>
          <Link href={href(view, next)} aria-label="Next" className="rounded-lg px-3 py-1.5 text-lg text-muted hover:bg-raised hover:text-ink">
            ›
          </Link>
        </div>
      </div>

      {view === "week" ? (
        <CalendarWeek
          days={days.map(
            (d): WeekDay => ({
              date: d,
              weekday: WEEKDAY_SHORT[weekdayOf(d)],
              dayNumber: Number(d.slice(8)),
              isToday: d === today,
              isPast: compareLocalDates(d, today) < 0,
              classes: classesOn(d).map((c) => ({ id: c.id, name: c.name, color: c.color, starts_at: c.starts_at, ends_at: c.ends_at })),
              tasks: (byDay.get(d) ?? []).map(view_),
              gym: gymByDay.get(d) ?? [],
            }),
          )}
        />
      ) : (
        <>
          <MonthGrid focus={focus} today={today} byDay={byDay} classById={classById} classesOn={classesOn} gymByDay={gymByDay} href={href} />
          <DayAgenda
            title={focus === today ? "Today" : formatLocalDate(focus)}
            classes={classesOn(focus)}
            tasks={(byDay.get(focus) ?? []).map(view_)}
            gym={gymByDay.get(focus) ?? []}
          />
        </>
      )}

      <p className="text-xs text-faint">
        <span className="lg:hidden">Tap a task to change its day. </span>
        <span className="hidden lg:inline">Tip: drag a task onto another day to move it. </span>
        Swipe left/right to change sections.
      </p>
    </div>
  );
}

function MonthGrid({
  focus,
  today,
  byDay,
  classById,
  classesOn,
  gymByDay,
  href,
}: {
  focus: string;
  today: string;
  byDay: Map<string, TaskRecord[]>;
  classById: Map<string, { color: string }>;
  classesOn: (d: string) => { id: string; color: string }[];
  gymByDay: Map<string, string[]>;
  href: (v: string, d: string) => string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface/80 p-1.5 shadow-card sm:p-2">
      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthGrid(focus).map(({ date, inMonth }) => {
          const tasks = byDay.get(date) ?? [];
          const open = tasks.filter((t) => t.status !== "done");
          const classes = classesOn(date);
          const isToday = date === today;
          const selected = date === focus;
          const past = date < today;
          return (
            <Link
              key={date}
              href={href("month", date)}
              scroll={false}
              className={cx(
                "flex min-h-[4.75rem] min-w-0 flex-col gap-0.5 overflow-hidden rounded-xl border p-1 transition hover:border-accent/60 sm:min-h-24 sm:p-1.5",
                selected ? "border-accent bg-accent/10 shadow-glow" : isToday ? "border-accent/50 bg-raised/60" : "border-transparent bg-raised/40",
                !inMonth && "opacity-30",
                inMonth && past && !selected && "opacity-60",
              )}
            >
              <span className="flex items-center justify-between gap-0.5">
                <span
                  className={cx(
                    "flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    isToday ? "bg-accent text-accent-ink" : "text-ink",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                {(gymByDay.get(date) ?? []).some((g) => !g.startsWith("Skipped")) && <span className="text-[9px] leading-none">🏋️</span>}
                {classes.length > 0 && (
                  <span className="flex gap-px" title="Class day">
                    {classes.slice(0, 2).map((c) => (
                      <span key={c.id} className="h-1 w-1 rounded-full" style={{ backgroundColor: c.color }} />
                    ))}
                  </span>
                )}
              </span>
              {open.slice(0, 2).map((t) => {
                const color = (t.class_id && classById.get(t.class_id)?.color) || "var(--color-accent)";
                return (
                  <span
                    key={t.id}
                    className="truncate rounded-[5px] border-l-2 px-1 py-px text-[9px] leading-tight font-medium text-ink sm:text-[11px]"
                    style={{ borderLeftColor: color, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
                  >
                    {t.title}
                  </span>
                );
              })}
              {open.length > 2 && <span className="px-1 text-[9px] leading-none font-semibold text-muted">+{open.length - 2} more</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** The tapped day, in full: its classes with times, then everything due. */
function DayAgenda({
  title,
  classes,
  tasks,
  gym,
}: {
  title: string;
  classes: { id: string; name: string; color: string; starts_at: string; ends_at: string }[];
  tasks: TaskView[];
  gym: string[];
}) {
  return (
    <section className="fade-in flex flex-col gap-3 rounded-3xl border border-line bg-surface/80 p-4 shadow-card">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {classes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-raised/60 px-3 py-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {formatTimeOfDay(c.starts_at)} – {formatTimeOfDay(c.ends_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {gym.length > 0 && (
        <p className="flex flex-wrap gap-1.5 text-xs">
          {gym.map((g) => (
            <span key={g} className="rounded-md bg-[#ff6b4a]/15 px-2 py-1 font-semibold text-[#ff6b4a]">
              {g.startsWith("Skipped") ? `⏭️ ${g}` : `🏋️ ${g} day`}
            </span>
          ))}
        </p>
      )}
      {tasks.length > 0 ? (
        <ul className="rows flex flex-col gap-2">
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{classes.length ? "Nothing due this day." : "Free day. Nothing due."}</p>
      )}
    </section>
  );
}
