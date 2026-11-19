import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { addDays, toLocalDate, weekdayOf } from "@/lib/time";
import { describeTarget, streak, strength, thisWeek, type HabitTarget } from "@/lib/habits";
import { PageHeader } from "@/components/ui";
import { ProgressRing } from "@/components/progress-ring";
import { HabitCard, type HabitCardData } from "@/components/habit-card";
import { NewHabit } from "@/components/new-habit";
import { JournalCard } from "@/components/journal-card";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Life: habits with streaks and strength (docs/02 + 03 ideas, our own version). */
export default async function LifePage() {
  const supabase = await createClient();
  const settings = await loadSettings(supabase);
  const today = toLocalDate(new Date(), settings.timeZone);
  const since = addDays(today, -70);

  const [{ data: habits }, { data: checkins }, { data: journal }] = await Promise.all([
    supabase.from("habits").select("id, name, emoji, color, target_times, target_per, started_on").is("deleted_at", null).eq("archived", false).order("sort").order("created_at"),
    supabase.from("habit_checkins").select("habit_id, on_date").gte("on_date", since),
    supabase.from("journal_entries").select("on_date, mood, body").gte("on_date", addDays(today, -6)),
  ]);
  const entryByDay = new Map((journal ?? []).map((j) => [j.on_date, j]));
  const todayEntry = entryByDay.get(today);

  const byHabit = new Map<string, Set<string>>();
  for (const c of checkins ?? []) {
    if (!byHabit.has(c.habit_id)) byHabit.set(c.habit_id, new Set());
    byHabit.get(c.habit_id)!.add(c.on_date);
  }

  // This week, Monday to Sunday.
  const wd = weekdayOf(today);
  const monday = addDays(today, wd === 0 ? -6 : 1 - wd);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const cards: HabitCardData[] = (habits ?? []).map((h) => {
    const set = byHabit.get(h.id) ?? new Set<string>();
    const target: HabitTarget = { times: h.target_times, per: h.target_per === "week" ? "week" : "day" };
    return {
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      color: h.color,
      targetText: describeTarget(target),
      strength: strength(set, target, today, h.started_on),
      streak: streak(set, target, today),
      streakUnit: target.per,
      weekProgress: target.per === "week" ? `${thisWeek(set, today)}/${target.times} this week` : null,
      today,
      days: week.map((d) => ({ date: d, label: DAY_LETTERS[weekdayOf(d)], checked: set.has(d), future: d > today })),
    };
  });

  const doneToday = cards.filter((c) => c.days.some((d) => d.date === today && d.checked)).length;
  const dailyCount = cards.length;

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Life" subtitle="Habits & journal">
        <Link
          href="/gym"
          className="glow-gym rounded-xl border px-3 py-1.5 text-sm font-semibold transition active:scale-95"
          style={{ borderColor: "#ff6b4a88", color: "#ff6b4a" }}
        >
          🏋️ Gym
        </Link>
      </PageHeader>

      {cards.length > 0 ? (
        <section className="hero flex items-center gap-4 rounded-3xl border border-accent/30 bg-surface/70 p-5 shadow-glow">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Today</p>
            <p className="mt-1 font-display text-2xl leading-tight font-semibold text-balance">
              {doneToday === dailyCount ? "Every habit done. 🔥" : `${dailyCount - doneToday} habit${dailyCount - doneToday === 1 ? "" : "s"} to go`}
            </p>
            <p className="mt-1 text-sm text-muted">Small every day beats big once in a while.</p>
          </div>
          <ProgressRing done={doneToday} total={dailyCount} />
        </section>
      ) : (
        <section className="hero rounded-3xl border border-accent/30 bg-surface/70 p-5 shadow-glow">
          <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Start small</p>
          <p className="mt-1 font-display text-2xl font-semibold">Build a habit or two</p>
          <p className="mt-1 text-sm text-muted">Tap once a day to check in. Streaks and a strength ring show your progress; one missed day won&apos;t wipe it out.</p>
        </section>
      )}

      {cards.length > 0 && (
        <ul className="rows grid gap-3 md:grid-cols-2">
          {cards.map((h) => (
            <HabitCard key={h.id} habit={h} />
          ))}
        </ul>
      )}

      <NewHabit open={cards.length === 0} />

      <JournalCard
        today={today}
        initialMood={todayEntry?.mood ?? null}
        initialBody={todayEntry?.body ?? ""}
        week={Array.from({ length: 7 }, (_, i) => {
          const d = addDays(today, i - 6);
          const e = entryByDay.get(d);
          return { date: d, label: DAY_LETTERS[weekdayOf(d)], mood: e?.mood ?? null, hasText: Boolean(e?.body) };
        })}
      />
    </div>
  );
}
