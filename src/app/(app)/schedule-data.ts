import { createClient } from "@/lib/supabase/server";
import { classesOn, type ScheduleContext } from "@/lib/schedule";
import type { LocalDate } from "@/lib/time";

export type DayClass = { id: string; name: string; color: string; starts_at: string; ends_at: string };

/**
 * Loads the current term's schedule and class times once, and returns a
 * function that lists the classes meeting on any date (src/lib/schedule).
 */
export async function loadSchedule(): Promise<(date: LocalDate) => DayClass[]> {
  const supabase = await createClient();
  const [{ data: term }, { data: rows }] = await Promise.all([
    supabase
      .from("terms")
      .select("id, starts_on, ends_on, schedules(kind, school_weekdays, day_labels, anchor_date, anchor_label), no_school_days(date)")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("class_meetings")
      .select("id, weekday, day_label, starts_at, ends_at, classes!inner(id, name, color, deleted_at, archived)")
      .is("classes.deleted_at", null)
      .eq("classes.archived", false),
  ]);
  if (!term?.schedules) return () => [];

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
    row: r,
  }));

  return (date) =>
    classesOn(date, ctx, meetings).map((m) => {
      const r = (m as (typeof meetings)[number]).row;
      return { id: r.id, name: r.classes.name, color: r.classes.color, starts_at: r.starts_at, ends_at: r.ends_at };
    });
}
