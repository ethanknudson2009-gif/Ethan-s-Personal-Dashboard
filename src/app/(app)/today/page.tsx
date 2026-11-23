import Link from "next/link";
import { Suspense } from "react";
import { formatLocalDate, formatTimeOfDay, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/format";
import { addDays, toLocalDate, weekdayOf, zonedParts } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { Card, ColorDot, cx, PageHeader } from "@/components/ui";
import { TaskItem } from "@/components/task-item";
import { AddButton } from "@/components/add-button";
import { IconInbox } from "@/components/icons";
import { RemindersNudge } from "@/components/notifications-card";
import { ProgressRing } from "@/components/progress-ring";
import { QuickActions } from "@/components/quick-actions";
import { WeekStrip, type StripDay } from "@/components/week-strip";
import { HabitChips } from "@/components/habit-chips";
import { LevelBar } from "@/components/level-bar";
import { SnoozeBar } from "@/components/snooze-bar";
import { totalXp } from "@/lib/xp";
import { dollars, monthKey, monthTotals } from "@/lib/money/summary";
import { groupByDue, loadTaskData } from "../tasks/data";
import { loadSchedule } from "../schedule-data";
import { ritualFor } from "@/lib/day-plan";
import { GymUpNext, type UpNext } from "@/components/gym-up-next";
import { DEFAULT_SPLIT } from "@/lib/gym-speech";
import { musclesOfDay } from "@/lib/gym-plan";
import { coachTips } from "@/lib/gym-coach";

/**
 * Today: one glance answers "what needs doing?" A hero card with today's
 * progress ring and Talk/Type buttons, then Do now, today's classes, and
 * what's coming up.
 */
export default async function TodayPage() {
  const data = await loadTaskData();
  const { timeZone } = data.settings;
  const today = toLocalDate(data.now, timeZone);
  const nowParts = zonedParts(data.now, timeZone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;

  const supabase = await createClient();
  const [classesOn, { count: inboxCount }, { data: habits }, { data: habitDone }, { count: tasksDone }, { count: habitCheckins }, { data: focused }] = await Promise.all([
    loadSchedule(),
    supabase.from("inbox_items").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    supabase.from("habits").select("id, name, emoji, color").is("deleted_at", null).eq("archived", false).order("sort").order("created_at"),
    supabase.from("habit_checkins").select("habit_id").eq("on_date", today),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").is("deleted_at", null),
    supabase.from("habit_checkins").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("minutes_done").gt("minutes_done", 0).is("deleted_at", null),
  ]);
  const [{ data: money }, { data: workouts }, { data: food }, { data: profile }] = await Promise.all([
    supabase.from("money_transactions").select("occurred_on, amount_cents, category").gte("occurred_on", `${today.slice(0, 7)}-01`).is("deleted_at", null),
    supabase
      .from("workouts")
      .select("started_at, ended_at, split_day, skipped, workout_sets(exercise_id, weight_lb, reps, done)")
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .limit(60),
    supabase.from("food_entries").select("calories").eq("on_date", today),
    supabase.from("profiles").select("calorie_goal, gym_split, gym_next").maybeSingle(),
  ]);
  const { data: dayPlan } = await supabase.from("day_plans").select("focus_task_ids, intention, planned_at, shutdown_at").eq("on_date", today).maybeSingle();
  const caloriesToday = (food ?? []).reduce((n, f) => n + (f.calories ?? 0), 0);
  const calorieGoal = profile?.calorie_goal ?? null;
  const monthMoney = monthTotals(
    (money ?? []).map((m) => ({ occurredOn: m.occurred_on, amountCents: m.amount_cents, category: m.category })),
    monthKey(today),
  );
  // Gym: finished, not-skipped workouts count; an unfinished one is "in progress".
  const trained = (workouts ?? []).filter((w) => w.ended_at && !w.skipped);
  const gymThisWeek = trained.filter((w) => toLocalDate(new Date(w.started_at), timeZone) >= addDays(today, -6)).length;
  const lastWorkout = trained[0] ? toLocalDate(new Date(trained[0].started_at), timeZone) : null;
  const upNext = await gymUpNext(supabase, workouts ?? [], profile, today, timeZone);
  const workOpen = data.open.filter((t) => t.area === "work");
  const xp = totalXp({
    tasksDone: tasksDone ?? 0,
    habitCheckins: habitCheckins ?? 0,
    focusMinutes: (focused ?? []).reduce((sum, t) => sum + t.minutes_done, 0),
  });
  const doneHabitIds = new Set((habitDone ?? []).map((c) => c.habit_id));
  const todaysClasses = classesOn(today);

  const buckets = groupByDue(data.open, data.now, timeZone);
  const overdue = buckets.find((b) => b.key === "overdue")?.tasks ?? [];
  const doNow = [...overdue, ...(buckets.find((b) => b.key === "today")?.tasks ?? [])];
  const comingUp = [...(buckets.find((b) => b.key === "tomorrow")?.tasks ?? []), ...(buckets.find((b) => b.key === "week")?.tasks ?? [])];
  const later = buckets.find((b) => b.key === "later")?.tasks ?? [];
  const someday = buckets.find((b) => b.key === "none")?.tasks ?? [];
  const doneToday = data.recentlyDone.filter((t) => t.completed_at && toLocalDate(new Date(t.completed_at), timeZone) === today).length;

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const nextClass = todaysClasses.find((c) => toMinutes(c.ends_at) > nowMinutes);
  const inClass = nextClass && toMinutes(nextClass.starts_at) <= nowMinutes;
  // Next 7 days for the strip: a colored dot per thing due.
  const dueByDay = new Map<string, string[]>();
  for (const t of data.open) {
    if (!t.due_at) continue;
    const d = toLocalDate(new Date(t.due_at), timeZone);
    const color = (t.class_id && data.classById.get(t.class_id)?.color) || "#2ee6c9";
    dueByDay.set(d, [...(dueByDay.get(d) ?? []), color]);
  }
  const strip: StripDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    return {
      date: d,
      weekday: WEEKDAY_SHORT[weekdayOf(d)],
      day: Number(d.slice(8)),
      isToday: i === 0,
      dots: dueByDay.get(d) ?? [],
      hasClasses: classesOn(d).length > 0,
    };
  });

  const greeting = nowParts.hour < 12 ? "Good morning" : nowParts.hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Today" subtitle={`${WEEKDAY_LONG[weekdayOf(today)]} · ${formatLocalDate(today).split(", ")[1]}`}>
        <div className="flex items-center gap-2">
          {inboxCount ? (
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 rounded-xl border border-warn/40 bg-warn/10 px-2.5 py-2 text-xs font-semibold whitespace-nowrap text-warn shadow-glow-warn md:hidden"
            >
              <IconInbox size={15} /> {inboxCount} to review
            </Link>
          ) : null}
          <AddButton />
        </div>
      </PageHeader>

      {/* Opened from a task reminder: Done / Snooze in one tap. */}
      <Suspense fallback={null}>
        <SnoozeBar tasks={data.open.map((t) => ({ id: t.id, title: data.view(t).displayTitle }))} />
      </Suspense>

      <LevelBar xp={xp} />

      {/* Hero */}
      <section className="hero rounded-3xl border border-accent/30 bg-surface/70 p-5 shadow-glow">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">{greeting}</p>
            <p className="mt-1 font-display text-2xl leading-tight font-semibold text-balance">
              {doNow.length === 0 ? "You're all caught up." : `${doNow.length} ${doNow.length === 1 ? "thing needs" : "things need"} you today`}
            </p>
            {overdue.length > 0 && <p className="mt-1 text-sm font-medium text-danger">{overdue.length} overdue</p>}
          </div>
          <ProgressRing done={doneToday} total={doneToday + doNow.length} />
        </div>

        {nextClass && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-bg/40 px-3 py-2 text-sm">
            <ColorDot color={nextClass.color} />
            <span className="shrink-0 text-muted">{inClass ? "In class:" : "Next:"}</span>
            <span className="min-w-0 truncate font-medium">{nextClass.name}</span>
            <span className="ml-auto shrink-0 text-xs text-faint">{formatTimeOfDay(inClass ? nextClass.ends_at : nextClass.starts_at).replace(":00", "")}{inClass ? " end" : ""}</span>
          </div>
        )}

        <div className="mt-4">
          <QuickActions />
        </div>
      </section>

      {/* Morning Plan / Evening Shutdown, and today's top 3 once planned. */}
      {(() => {
        const ritual = ritualFor(data.now, timeZone);
        const focus = (dayPlan?.focus_task_ids ?? []).map((id) => data.open.find((t) => t.id === id)).filter((t) => t !== undefined);
        const focusDone = (dayPlan?.focus_task_ids?.length ?? 0) - focus.length;
        const prompt =
          ritual === "morning" && !dayPlan?.planned_at
            ? { emoji: "☀️", title: "Plan your day", small: "Pick your top 3 · 1 min" }
            : ritual === "evening" && !dayPlan?.shutdown_at
              ? { emoji: "🌙", title: "Evening shutdown", small: "Check off, move the rest, how was today · 2 min" }
              : null;
        return (
          <>
            {prompt && (
              <Link href="/plan" className="flex items-center gap-3 rounded-2xl border border-electric/40 bg-electric/10 px-4 py-3 transition active:scale-[0.99]">
                <span className="text-2xl">{prompt.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{prompt.title}</span>
                  <span className="block text-xs text-muted">{prompt.small}</span>
                </span>
                <span className="text-muted">›</span>
              </Link>
            )}
            {dayPlan?.planned_at && (focus.length > 0 || focusDone > 0) && (
              <Card title={`Top 3 · ${focusDone}/${focusDone + focus.length} done`} action={<Link href="/plan" className="text-xs text-muted hover:text-ink">Change</Link>}>
                {dayPlan.intention && <p className="mb-2 text-sm text-muted italic">“{dayPlan.intention}”</p>}
                {focus.length ? (
                  <ul className="rows flex flex-col gap-2">
                    {focus.map((t) => (
                      <TaskItem key={t.id} task={data.view(t)} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm font-semibold text-ok">All three done 🎉</p>
                )}
              </Card>
            )}
          </>
        );
      })()}

      <GymUpNext up={upNext} />

      <WeekStrip days={strip} />

      {habits && habits.length > 0 && (
        <HabitChips today={today} habits={habits.map((h) => ({ ...h, done: doneHabitIds.has(h.id) }))} />
      )}

      {/* Every area at a glance: tap a tile to jump there. */}
      <section aria-label="At a glance" className="rows grid grid-cols-2 gap-2.5">
        <GlanceTile
          href="/work"
          color="#ffb547"
          label="💼 Work"
          big={workOpen.length === 0 ? "Clear" : `${workOpen.length} open`}
          small={workOpen[0]?.title ?? "Nothing for Mike right now"}
        />
        <GlanceTile
          href="/money"
          color="#3ddc97"
          label="💸 Money"
          big={`${dollars(monthMoney.outCents)} out`}
          small={monthMoney.inCents ? `${dollars(monthMoney.inCents)} in this month` : "Spent this month"}
        />
        <GlanceTile
          href="/gym"
          color="#ff6b4a"
          label="🏋️ Gym"
          big={`${gymThisWeek} this week`}
          small={lastWorkout ? (lastWorkout === today ? "Trained today 💪" : `Last: ${formatLocalDate(lastWorkout).split(",")[0]}`) : "Start your first workout"}
        />
        <GlanceTile
          href="/life"
          color="#ffb547"
          label="🍽️ Food"
          big={`${caloriesToday.toLocaleString()} cal`}
          small={calorieGoal ? `${Math.max(0, calorieGoal - caloriesToday).toLocaleString()} left of ${calorieGoal.toLocaleString()}` : (food ?? []).length ? `${(food ?? []).length} logged today` : "Say “ate … 500 calories”"}
        />
        <GlanceTile
          href="/life"
          color="#2ee6c9"
          label="✅ Habits"
          big={habits && habits.length ? `${doneHabitIds.size}/${habits.length}` : "None yet"}
          small={habits && habits.length ? (doneHabitIds.size >= habits.length ? "All done today 🔥" : "checked in today") : "Add one in Life"}
        />
        <GlanceTile
          href="/stats"
          color="#5b8cff"
          label="📊 Stats"
          big={`${tasksDone ?? 0} done`}
          small="Charts, streaks & best lifts"
        />
      </section>

      <RemindersNudge />

      <Card title="Do now">
        {doNow.length === 0 ? (
          <div className="relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl border border-ok/30 bg-ok/5 px-4 py-6 text-center">
            <span className="twinkle absolute top-3 left-6 text-ok">✦</span>
            <span className="twinkle twinkle-2 absolute top-8 right-8 text-accent">✦</span>
            <span className="twinkle twinkle-3 absolute bottom-3 left-1/3 text-electric">✦</span>
            <p className="font-display text-lg font-semibold text-ok">All clear</p>
            <p className="text-sm text-muted">Nothing due today. Enjoy it, or get ahead below.</p>
          </div>
        ) : (
          <ul className="rows flex flex-col gap-2">
            {doNow.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        )}
      </Card>

      {todaysClasses.length > 0 && (
        <Card title="Classes today">
          <ul className="rows flex flex-col gap-2">
            {todaysClasses.map((c) => {
              const start = toMinutes(c.starts_at);
              const end = toMinutes(c.ends_at);
              const now = nowMinutes >= start && nowMinutes < end;
              const past = nowMinutes >= end;
              return (
                <li
                  key={c.id}
                  className={cx(
                    "flex items-center gap-3 rounded-2xl border px-3 py-3",
                    now ? "wash-accent border-accent/50 shadow-glow" : "border-line bg-raised/70",
                    past && "opacity-45",
                  )}
                >
                  <ColorDot color={c.color} />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  <span className="shrink-0 text-[11px] whitespace-nowrap text-muted">
                    {formatTimeOfDay(c.starts_at)} – {formatTimeOfDay(c.ends_at)}
                  </span>
                  {now && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">NOW</span>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {comingUp.length > 0 && (
        <Card title="Coming up this week">
          <ul className="rows flex flex-col gap-2">
            {comingUp.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </Card>
      )}

      {later.length > 0 && (
        <Card title={`Later · ${later.length}`}>
          <ul className="rows flex flex-col gap-2">
            {later.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </Card>
      )}

      {someday.length > 0 && (
        <Card title={`No date · ${someday.length}`}>
          <ul className="rows flex flex-col gap-2">
            {someday.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </Card>
      )}

      {data.recentlyDone.length > 0 && (
        <details className="group rounded-3xl border border-line bg-surface/60 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Done this week · {data.recentlyDone.length}
            <span className="text-faint transition group-open:rotate-180">▾</span>
          </summary>
          <ul className="rows mt-3 flex flex-col gap-2">
            {data.recentlyDone.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </details>
      )}

      <p className="text-center text-xs text-muted">
        {data.open.length} open task{data.open.length === 1 ? "" : "s"} in all ·{" "}
        <Link href="/stats" className="text-accent">
          See your stats →
        </Link>
      </p>

      <p className="pb-2 text-center text-xs text-faint">Swipe left or right to move between sections.</p>
    </div>
  );
}

/** A small glowing tile that sums up one area and links to it. */
function GlanceTile({ href, color, label, big, small }: { href: string; color: string; label: string; big: string; small: string }) {
  return (
    <Link
      href={href}
      className="relative flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-2xl border bg-surface/80 px-3.5 py-3 transition active:scale-[0.97]"
      style={{ borderColor: `${color}55`, boxShadow: `0 0 22px -12px ${color}` }}
    >
      <span className="pointer-events-none absolute -top-8 -right-8 h-20 w-20 rounded-full opacity-25 blur-2xl" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-semibold tracking-wide" style={{ color }}>
        {label}
      </span>
      <span className="truncate font-display text-lg leading-tight font-semibold">{big}</span>
      <span className="truncate text-xs text-muted">{small}</span>
    </Link>
  );
}

type TodayWorkout = {
  started_at: string;
  ended_at: string | null;
  split_day: string | null;
  skipped: boolean;
  workout_sets: { exercise_id: string; weight_lb: number | null; reps: number | null; done: boolean }[];
};

/** What Home's gym card shows: the split day up next, a workout in progress, or "trained today". */
async function gymUpNext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workouts: TodayWorkout[],
  profile: { gym_split: string[] | null; gym_next: number | null } | null,
  today: string,
  timeZone: string,
): Promise<UpNext> {
  const split = profile?.gym_split?.length ? profile.gym_split : DEFAULT_SPLIT;
  const day = split[(profile?.gym_next ?? 0) % split.length];
  const open = workouts.find((w) => !w.ended_at);
  if (open) return { state: "open", day: open.split_day, sets: open.workout_sets.filter((s) => s.done).length };
  const local = (w: TodayWorkout) => toLocalDate(new Date(w.started_at), timeZone);
  const doneToday = workouts.find((w) => w.ended_at && !w.skipped && local(w) === today);
  if (doneToday) return { state: "done", trained: doneToday.split_day, next: day };

  const last = workouts.find((w) => w.ended_at && !w.skipped && w.split_day === day);
  const ids = [...new Set((last?.workout_sets ?? []).map((s) => s.exercise_id))];
  const { data: exercises } = await supabase.from("exercises").select("id, name, muscle, bodyweight");
  const name = new Map((exercises ?? []).map((e) => [e.id, e.name]));
  // The coach's top tip for an exercise on this day, if there is one.
  const tips = coachTips(
    workouts.map((w) => ({
      date: local(w),
      day: w.split_day,
      skipped: w.skipped || !w.ended_at,
      sets: w.workout_sets.map((s) => ({ exerciseId: s.exercise_id, weightLb: s.weight_lb === null ? null : Number(s.weight_lb), reps: s.reps, done: s.done })),
    })),
    (exercises ?? []).map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, bodyweight: e.bodyweight })),
    today,
  );
  const dayNames = ids.map((id) => name.get(id)).filter((n): n is string => !!n);
  const tip = tips.find((t) => dayNames.some((n) => t.title.includes(n)));
  return {
    state: "ready",
    day,
    muscles: musclesOfDay(day).map((m) => m.charAt(0).toUpperCase() + m.slice(1)),
    lastDone: last ? formatLocalDate(local(last)).split(",")[0] : null,
    lastExercises: dayNames.slice(0, 5),
    tip: tip ? tip.title : null,
  };
}
