import { createClient } from "@/lib/supabase/server";
import { classesOn, type ScheduleContext } from "@/lib/schedule";
import { formatLocalDate, formatTimeOfDay, WEEKDAY_LONG } from "@/lib/format";
import { toLocalDate, weekdayOf, zonedParts } from "@/lib/time";
import { Card, ColorDot, cx, EmptyState, PageHeader } from "@/components/ui";
import { TaskItem } from "@/components/task-item";
import { AddButton } from "@/components/add-button";
import { groupByDue, loadTaskData } from "../tasks/data";

/**
 * Today: your classes today, what to do now (overdue + due today), and
 * what's coming up. Built to answer "what needs doing?" at a glance.
 */
export default async function TodayPage() {
  const data = await loadTaskData();
  const { timeZone } = data.settings;
  const today = toLocalDate(data.now, timeZone);
  const nowParts = zonedParts(data.now, timeZone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;

  const todaysClasses = await loadTodaysClasses(today);
  const buckets = groupByDue(data.open, data.now, timeZone);
  const doNow = [...(buckets.find((b) => b.key === "overdue")?.tasks ?? []), ...(buckets.find((b) => b.key === "today")?.tasks ?? [])];
  const comingUp = [...(buckets.find((b) => b.key === "tomorrow")?.tasks ?? []), ...(buckets.find((b) => b.key === "week")?.tasks ?? [])].slice(0, 6);

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const nextClass = todaysClasses.find((c) => toMinutes(c.ends_at) > nowMinutes);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Today" subtitle={`${WEEKDAY_LONG[weekdayOf(today)]} · ${formatLocalDate(today).split(", ")[1]}`}>
        <AddButton />
      </PageHeader>

      {/* Hero: the one number that matters right now */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/20 via-electric/10 to-transparent p-5 shadow-glow">
        <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">Needs doing</p>
        <p className="font-display text-5xl font-semibold">{doNow.length}</p>
        <p className="text-sm text-muted">
          {doNow.length === 0
            ? "Nothing due today. Nice."
            : `${doNow.length === 1 ? "thing" : "things"} due today${buckets.some((b) => b.key === "overdue") ? " or overdue" : ""}`}
        </p>
        {nextClass && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <ColorDot color={nextClass.color} />
            <span className="text-muted">{toMinutes(nextClass.starts_at) <= nowMinutes ? "In class now:" : "Next class:"}</span>
            <span className="font-medium">{nextClass.name}</span>
            <span className="text-faint">{formatTimeOfDay(nextClass.starts_at)}</span>
          </p>
        )}
      </section>

      <Card title="Do now">
        {doNow.length === 0 ? (
          <EmptyState>You&apos;re all caught up for today.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {doNow.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        )}
      </Card>

      {todaysClasses.length > 0 && (
        <Card title="Classes today">
          <ul className="flex flex-col gap-2">
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
                    now ? "border-accent/50 bg-accent/10 shadow-glow" : "border-line bg-raised/70",
                    past && "opacity-50",
                  )}
                >
                  <ColorDot color={c.color} />
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-xs text-muted">
                    {formatTimeOfDay(c.starts_at)} – {formatTimeOfDay(c.ends_at)}
                  </span>
                  {now && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-ink">NOW</span>}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {comingUp.length > 0 && (
        <Card title="Coming up">
          <ul className="flex flex-col gap-2">
            {comingUp.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type TodayClass = { id: string; name: string; color: string; starts_at: string; ends_at: string };

/** Classes meeting today, using the term's schedule (src/lib/schedule). */
async function loadTodaysClasses(today: string): Promise<TodayClass[]> {
  const supabase = await createClient();
  const { data: term } = await supabase
    .from("terms")
    .select("id, starts_on, ends_on, schedules(kind, school_weekdays, day_labels, anchor_date, anchor_label), no_school_days(date)")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!term?.schedules) return [];

  const { data: rows } = await supabase
    .from("class_meetings")
    .select("id, weekday, day_label, starts_at, ends_at, classes!inner(id, name, color, deleted_at, archived)")
    .is("classes.deleted_at", null)
    .eq("classes.archived", false);

  const s = term.schedules;
  const ctx: ScheduleContext = {
    term: { startsOn: term.starts_on, endsOn: term.ends_on },
    schedule: {
      kind: s.kind === "rotating" ? "rotating" : "weekly",
      schoolWeekdays: s.school_weekdays,
      dayLabels: s.day_labels,
      anchorDate: s.anchor_date ?? term.starts_on,
      anchorLabel: s.anchor_label ?? s.day_labels[0] ?? "",
    },
    noSchoolDays: (term.no_school_days ?? []).map((d) => d.date),
  };

  const meetings = (rows ?? []).map((r) => ({
    classId: r.classes.id,
    weekday: r.weekday,
    dayLabel: r.day_label,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    _row: r,
  }));
  return classesOn(today, ctx, meetings).map((m) => {
    const r = (m as (typeof meetings)[number])._row;
    return { id: r.id, name: r.classes.name, color: r.classes.color, starts_at: r.starts_at, ends_at: r.ends_at };
  });
}
