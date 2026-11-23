import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { addDays, toLocalDate, weekdayOf } from "@/lib/time";
import { streak, type HabitTarget } from "@/lib/habits";
import { dollars, monthKey, monthTotals, shiftMonthKey } from "@/lib/money/summary";
import { totalXp, levelInfo, levelTitle } from "@/lib/xp";
import { bestLifts, busiestWeekday, compact, delta, habitRate, lastDays, lastWeeks, mostCommon, onTimeRate, shortDate, sumByDay, sumByWeek, volume, weeksInARow, type Delta } from "@/lib/stats";
import { Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { BarChart } from "@/components/stats-charts";

/** Area colors for charts (checked for color-blind safety on the dark background). */
const AREA = { school: "#5b8cff", work: "#c98420", personal: "#15a690" } as const;
const FIRE = "#ff6b4a";
const WEEKS = 8;
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Stats: how the weeks are going. This week vs last week at the top, then a
 * chart per area of life. Everything is worked out from what you logged
 * (src/lib/stats.ts), so it's always in sync.
 */
export default async function StatsPage() {
  const supabase = await createClient();
  const { timeZone } = await loadSettings(supabase);
  const today = toLocalDate(new Date(), timeZone);
  const weeks = lastWeeks(today, WEEKS);
  const since = weeks[0];
  const local = (iso: string | null) => (iso ? toLocalDate(new Date(iso), timeZone) : null);

  const [tasksRes, habitsRes, checkinsRes, workoutsRes, moneyRes, foodRes, profileRes, xpTasks, xpHabits, focusRes, openRes] = await Promise.all([
    supabase.from("tasks").select("completed_at, due_at, area").eq("status", "done").is("deleted_at", null).gte("completed_at", `${addDays(since, -1)}T00:00:00Z`),
    supabase.from("habits").select("id, name, emoji, color, target_times, target_per, started_on").is("deleted_at", null).eq("archived", false).order("sort"),
    supabase.from("habit_checkins").select("habit_id, on_date").gte("on_date", addDays(today, -70)),
    supabase
      .from("workouts")
      .select("started_at, skipped, workout_sets(weight_lb, reps, done, exercises(name))")
      .is("deleted_at", null)
      .not("ended_at", "is", null)
      .gte("started_at", `${addDays(today, -120)}T00:00:00Z`),
    supabase.from("money_transactions").select("occurred_on, amount_cents, category").is("deleted_at", null).gte("occurred_on", `${shiftMonthKey(monthKey(today), -1)}-01` < since ? `${shiftMonthKey(monthKey(today), -1)}-01` : since),
    supabase.from("food_entries").select("on_date, calories, protein_g").gte("on_date", addDays(today, -13)),
    supabase.from("profiles").select("calorie_goal").maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done").is("deleted_at", null),
    supabase.from("habit_checkins").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("minutes_done").gt("minutes_done", 0).is("deleted_at", null),
    supabase.from("tasks").select("due_at").eq("status", "open").is("deleted_at", null),
  ]);

  // ── Tasks ────────────────────────────────────────────────────────────
  const tasks = (tasksRes.data ?? []).map((t) => ({ day: local(t.completed_at), area: t.area }));
  const tasksByArea = (["school", "work", "personal"] as const).map((a) => ({
    name: a === "school" ? "School" : a === "work" ? "Work" : "Personal",
    color: AREA[a],
    values: sumByWeek(tasks.filter((t) => (t.area === "work" || t.area === "school" ? t.area : "personal") === a), (t) => t.day, () => 1, weeks),
  }));
  const tasksPerWeek = weeks.map((_, i) => tasksByArea.reduce((n, s) => n + s.values[i], 0));

  // ── Habits ───────────────────────────────────────────────────────────
  const byHabit = new Map<string, Set<string>>();
  for (const c of checkinsRes.data ?? []) {
    if (!byHabit.has(c.habit_id)) byHabit.set(c.habit_id, new Set());
    byHabit.get(c.habit_id)!.add(c.on_date);
  }
  const habits = (habitsRes.data ?? []).map((h) => {
    const set = byHabit.get(h.id) ?? new Set<string>();
    const target: HabitTarget = { times: h.target_times, per: h.target_per === "week" ? "week" : "day" };
    return { ...h, rate: habitRate(set, today, 30, h.started_on), streak: streak(set, target, today), unit: target.per };
  });
  const checkinsPerWeek = sumByWeek(checkinsRes.data ?? [], (c) => c.on_date, () => 1, weeks);

  // ── Gym ──────────────────────────────────────────────────────────────
  const workouts = (workoutsRes.data ?? []).filter((w) => !w.skipped);
  const sessionsPerWeek = sumByWeek(workouts, (w) => local(w.started_at), () => 1, weeks);
  const volumePerWeek = sumByWeek(
    workouts,
    (w) => local(w.started_at),
    (w) => volume(w.workout_sets.map((s) => ({ weightLb: s.weight_lb, reps: s.reps, done: s.done }))),
    weeks,
  );
  const lifts = bestLifts(
    workouts.flatMap((w) =>
      w.workout_sets.map((s) => ({ exercise: s.exercises?.name ?? "Exercise", weightLb: s.weight_lb, reps: s.reps, done: s.done, day: local(w.started_at)! })),
    ),
  );

  // ── Money ────────────────────────────────────────────────────────────
  const tx = (moneyRes.data ?? []).map((m) => ({ occurredOn: m.occurred_on, amountCents: m.amount_cents, category: m.category }));
  const spentPerWeek = sumByWeek(tx, (t) => t.occurredOn, (t) => (t.amountCents < 0 ? -t.amountCents / 100 : 0), weeks);
  const thisMonth = monthTotals(tx, monthKey(today));
  const lastMonth = monthTotals(tx, shiftMonthKey(monthKey(today), -1));
  const topCategories = thisMonth.categories.slice(0, 5);

  // ── Food ─────────────────────────────────────────────────────────────
  const days = lastDays(today, 14);
  const calories = sumByDay(foodRes.data ?? [], (f) => f.on_date, (f) => f.calories ?? 0, days);
  const loggedDays = calories.filter((c, i) => c > 0 && days[i] !== today);
  const avgCalories = loggedDays.length ? Math.round(loggedDays.reduce((a, b) => a + b, 0) / loggedDays.length) : null;
  const goal = profileRes.data?.calorie_goal ?? null;

  // ── Level ────────────────────────────────────────────────────────────
  const focusMinutes = (focusRes.data ?? []).reduce((n, t) => n + t.minutes_done, 0);
  const xp = totalXp({ tasksDone: xpTasks.count ?? 0, habitCheckins: xpHabits.count ?? 0, focusMinutes });
  const lvl = levelInfo(xp);

  const last = WEEKS - 1;

  // ── Highlights ─────────────────────────────────────────────────────────
  const monthStart = `${monthKey(today)}-01`;
  const doneDays = tasks.map((t) => t.day).filter((d): d is string => Boolean(d));
  const fourWeeksAgo = addDays(today, -27);
  const doneLast4Weeks = doneDays.filter((d) => d >= fourWeeksAgo).length;
  const onTime = onTimeRate(
    (tasksRes.data ?? []).filter((t) => (local(t.completed_at) ?? "") >= addDays(today, -29)).map((t) => ({ completedAt: t.completed_at, dueAt: t.due_at })),
  );
  const busiest = busiestWeekday(doneDays);
  const nowIso = new Date().toISOString();
  const open = openRes.data ?? [];
  const overdue = open.filter((t) => t.due_at && t.due_at < nowIso).length;
  const bestStreak = habits.reduce<(typeof habits)[number] | null>((b, h) => (!b || h.streak > b.streak ? h : b), null);
  const perfectDays = lastDays(today, 7).filter((d) => {
    const daily = habits.filter((h) => h.unit === "day" && h.started_on <= d);
    return daily.length > 0 && daily.every((h) => byHabit.get(h.id)?.has(d));
  }).length;
  const gymStreak = weeksInARow(sessionsPerWeek);
  const workoutsThisMonth = workouts.filter((w) => (local(w.started_at) ?? "") >= monthStart).length;
  const allSets = workouts.flatMap((w) => w.workout_sets.filter((x) => x.done));
  const totalVolume = volume(allSets.map((x) => ({ weightLb: x.weight_lb, reps: x.reps, done: true })));
  const favorite = mostCommon(allSets.map((x) => x.exercises?.name ?? "Exercise"));
  const dayOfMonth = Number(today.slice(8));
  const spendPerDay = thisMonth.outCents / 100 / dayOfMonth;
  const foodDaysThisWeek = calories.slice(-7).filter((c) => c > 0).length;
  const proteinByDay = sumByDay(foodRes.data ?? [], (f) => f.on_date, (f) => f.protein_g ?? 0, days).filter((p, i) => p > 0 && days[i] !== today);
  const avgProtein = proteinByDay.length ? Math.round(proteinByDay.reduce((a, b) => a + b, 0) / proteinByDay.length) : null;

  const highlights: { label: string; value: string; note?: string }[] = [
    { label: "Tasks done (all time)", value: (xpTasks.count ?? 0).toLocaleString() },
    { label: "Tasks done per day", value: (doneLast4Weeks / 28).toFixed(1), note: "last 4 weeks" },
    { label: "On time", value: onTime.of ? `${Math.round((onTime.onTime / onTime.of) * 100)}%` : "–", note: onTime.of ? `${onTime.onTime} of ${onTime.of} with a due date` : "last 30 days" },
    { label: "Busiest day", value: busiest !== null ? DAY_LONG[busiest] : "–", note: "most tasks finished" },
    { label: "Open tasks", value: open.length.toLocaleString(), note: overdue ? `${overdue} overdue` : "none overdue" },
    { label: "Longest habit streak", value: bestStreak && bestStreak.streak ? `${bestStreak.streak} ${bestStreak.unit === "week" ? "wk" : "d"}` : "–", note: bestStreak && bestStreak.streak ? bestStreak.name : undefined },
    { label: "Perfect habit days", value: `${perfectDays}/7`, note: "every daily habit done" },
    { label: "Gym streak", value: `${gymStreak} wk`, note: "weeks in a row with a workout" },
    { label: "Workouts this month", value: workoutsThisMonth.toLocaleString() },
    { label: "Lifted (4 months)", value: `${compact(totalVolume)} lb`, note: `${allSets.length.toLocaleString()} sets` },
    { label: "Favorite exercise", value: favorite ? favorite.item : "–", note: favorite ? `${favorite.count} sets` : undefined },
    { label: "Spending per day", value: dollars(Math.round(spendPerDay * 100)), note: "this month so far" },
    { label: "Food logged", value: `${foodDaysThisWeek}/7 days`, note: "this week" },
    { label: "Avg protein", value: avgProtein !== null ? `${avgProtein} g` : "–", note: "on days you logged" },
  ];
  const weekLabels = weeks.map((w) => `Week of ${shortDate(w)}`);

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Stats" subtitle="How your weeks are going" />

      <section className="hero rounded-3xl border border-accent/30 bg-surface/70 p-5 shadow-glow">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">This week vs last week</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Tasks done" d={delta(tasksPerWeek[last], tasksPerWeek[last - 1])} />
          <Tile label="Habit check-ins" d={delta(checkinsPerWeek[last], checkinsPerWeek[last - 1])} />
          <Tile label="Workouts" d={delta(sessionsPerWeek[last], sessionsPerWeek[last - 1])} />
          <Tile label="Spent" d={delta(spentPerWeek[last], spentPerWeek[last - 1])} money upIsBad />
        </div>
        <p className="mt-4 text-sm text-muted">
          Level {lvl.level} · <span className="text-accent">{levelTitle(lvl.level)}</span> · {xp.toLocaleString()} XP total · {focusMinutes.toLocaleString()} min of
          focus
        </p>
      </section>

      <Card title="Highlights">
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {highlights.map((h) => (
            <li key={h.label} className="min-w-0 rounded-2xl border border-line bg-raised/60 p-3">
              <p className="truncate text-xs text-muted">{h.label}</p>
              <p className="truncate font-display text-lg font-semibold tabular-nums">{h.value}</p>
              {h.note && <p className="truncate text-[11px] text-faint">{h.note}</p>}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Tasks finished">
        <BarChart labels={weekLabels} series={tasksByArea} emptyText="Finish a task to start the chart" />
      </Card>

      <Card title="Gym" action={<Link href="/gym" className="-my-2 py-2 pl-3 text-sm text-muted hover:text-ink">Open →</Link>}>
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Pounds lifted per week</p>
            <BarChart labels={weekLabels} series={[{ name: "Volume", color: FIRE, values: volumePerWeek }]} unit="lb" format="compact" emptyText="Finish a workout to start the chart" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Workouts per week</p>
            <BarChart labels={weekLabels} series={[{ name: "Workouts", color: FIRE, values: sessionsPerWeek }]} height={90} emptyText="No workouts yet" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Best lifts (last 4 months)</p>
            {lifts.length ? (
              <ul className="flex flex-col divide-y divide-line">
                {lifts.map((l) => (
                  <li key={l.exercise} className="flex items-baseline gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{l.exercise}</span>
                    <span className="font-display font-semibold tabular-nums">
                      {l.weightLb} lb × {l.reps}
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-faint">{shortDate(l.day)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Your heaviest set on each exercise shows up here.</EmptyState>
            )}
          </div>
        </div>
      </Card>

      <Card title="Habits · last 30 days" action={<Link href="/life" className="-my-2 py-2 pl-3 text-sm text-muted hover:text-ink">Open →</Link>}>
        {habits.length ? (
          <ul className="flex flex-col gap-3">
            {habits.map((h) => {
              const pct = h.rate.of ? Math.round((h.rate.hit / h.rate.of) * 100) : 0;
              return (
                <li key={h.id}>
                  <div className="mb-1 flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {h.emoji ? `${h.emoji} ` : ""}
                      {h.name}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      {h.rate.hit}/{h.rate.of} days
                    </span>
                    <span className="w-12 text-right font-semibold tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: h.color ?? "var(--color-accent)" }} />
                  </div>
                  {h.streak > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      🔥 {h.streak} {h.unit === "week" ? "week" : "day"}
                      {h.streak === 1 ? "" : "s"} in a row
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Add a habit in Life to see how often you hit it.</EmptyState>
        )}
      </Card>

      <Card title="Money" action={<Link href="/money" className="-my-2 py-2 pl-3 text-sm text-muted hover:text-ink">Open →</Link>}>
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Spent per week</p>
            <BarChart
              labels={weekLabels}
              series={[{ name: "Spent", color: AREA.work, values: spentPerWeek }]}
              format="money"
              emptyText="No spending logged"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-raised/60 p-3">
              <p className="text-xs text-muted">Spent this month</p>
              <p className="font-display text-xl font-semibold tabular-nums">{dollars(thisMonth.outCents)}</p>
              <p className="text-xs text-faint">Last month {dollars(lastMonth.outCents)}</p>
            </div>
            <div className="rounded-2xl border border-line bg-raised/60 p-3">
              <p className="text-xs text-muted">Came in this month</p>
              <p className="font-display text-xl font-semibold tabular-nums">{dollars(thisMonth.inCents)}</p>
              <p className="text-xs text-faint">Last month {dollars(lastMonth.inCents)}</p>
            </div>
          </div>
          {topCategories.length > 0 && (
            <ul className="flex flex-col gap-2">
              {topCategories.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="capitalize">{c.name}</span>
                    <span className="tabular-nums">{dollars(c.cents)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (c.cents / topCategories[0].cents) * 100)}%`, backgroundColor: AREA.work }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card title="Food · last 14 days" action={<Link href="/life" className="-my-2 py-2 pl-3 text-sm text-muted hover:text-ink">Open →</Link>}>
        <BarChart
          labels={days.map((d) => `${DAY[weekdayOf(d)]} ${Number(d.slice(8))}`)}
          series={[{ name: "Calories", color: AREA.personal, values: calories }]}
          unit="cal"
          goal={goal}
          goalLabel={goal ? `goal ${goal.toLocaleString()}` : undefined}
          emptyText="Log food to see your calories"
        />
        <p className="mt-3 text-sm text-muted">
          {avgCalories !== null ? `Averaging ${avgCalories.toLocaleString()} cal on days you logged` : "No food logged before today yet"}
          {goal && avgCalories !== null ? ` · goal ${goal.toLocaleString()}` : ""}
        </p>
      </Card>
    </div>
  );
}

/** One "this week" number with the change from last week. */
function Tile({ label, d, money, upIsBad }: { label: string; d: Delta; money?: boolean; upIsBad?: boolean }) {
  const show = (n: number) => (money ? `$${Math.round(n).toLocaleString()}` : n.toLocaleString());
  const good = upIsBad ? d.change < 0 : d.change > 0;
  return (
    <div className="rounded-2xl border border-line bg-raised/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">{show(d.now)}</p>
      <p className={cx("text-xs tabular-nums", d.change === 0 ? "text-faint" : good ? "text-ok" : "text-warn")}>
        {d.change === 0 ? "Same as last week" : `${d.change > 0 ? "▲" : "▼"} ${show(Math.abs(d.change))}${d.percent !== null ? ` (${Math.abs(d.percent)}%)` : ""} vs last week`}
      </p>
    </div>
  );
}
