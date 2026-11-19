import Link from "next/link";
import { formatLocalDate, formatTimeOfDay, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/format";
import { addDays, toLocalDate, weekdayOf, zonedParts } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { Card, ColorDot, cx, PageHeader } from "@/components/ui";
import { TaskItem } from "@/components/task-item";
import { AddButton } from "@/components/add-button";
import { IconInbox, IconSettings } from "@/components/icons";
import { RemindersNudge } from "@/components/notifications-card";
import { ProgressRing } from "@/components/progress-ring";
import { QuickActions } from "@/components/quick-actions";
import { WeekStrip, type StripDay } from "@/components/week-strip";
import { HabitChips } from "@/components/habit-chips";
import { LevelBar } from "@/components/level-bar";
import { totalXp } from "@/lib/xp";
import { dollars, monthKey, monthTotals } from "@/lib/money/summary";
import { MOODS } from "@/lib/moods";
import { groupByDue, loadTaskData } from "../tasks/data";
import { loadSchedule } from "../schedule-data";

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
  const [{ data: money }, { data: workouts }, { data: journal }, { data: food }, { data: profile }] = await Promise.all([
    supabase.from("money_transactions").select("occurred_on, amount_cents, category").gte("occurred_on", `${today.slice(0, 7)}-01`).is("deleted_at", null),
    supabase.from("workouts").select("started_at").not("ended_at", "is", null).is("deleted_at", null).order("started_at", { ascending: false }).limit(10),
    supabase.from("journal_entries").select("mood, body").eq("on_date", today).maybeSingle(),
    supabase.from("food_entries").select("calories").eq("on_date", today),
    supabase.from("profiles").select("calorie_goal").maybeSingle(),
  ]);
  const caloriesToday = (food ?? []).reduce((n, f) => n + (f.calories ?? 0), 0);
  const calorieGoal = profile?.calorie_goal ?? null;
  const monthMoney = monthTotals(
    (money ?? []).map((m) => ({ occurredOn: m.occurred_on, amountCents: m.amount_cents, category: m.category })),
    monthKey(today),
  );
  const gymThisWeek = (workouts ?? []).filter((w) => toLocalDate(new Date(w.started_at), timeZone) >= addDays(today, -6)).length;
  const lastWorkout = workouts?.[0] ? toLocalDate(new Date(workouts[0].started_at), timeZone) : null;
  const mood = MOODS.find((m) => m.value === journal?.mood);
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
          <Link href="/settings" aria-label="Settings" className="rounded-xl border border-line bg-surface p-2 text-muted hover:text-ink md:hidden">
            <IconSettings size={18} />
          </Link>
        </div>
      </PageHeader>

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
          color="#5b8cff"
          label="📓 Journal"
          big={mood ? `${mood.emoji} ${mood.label}` : "Not yet"}
          small={journal?.body ? journal.body.slice(0, 60) : "How was today?"}
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
        <Card
          title="Later"
          action={
            <Link href="/tasks" className="text-xs text-muted hover:text-ink">
              See all →
            </Link>
          }
        >
          <ul className="rows flex flex-col gap-2">
            {later.slice(0, 8).map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </Card>
      )}

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
