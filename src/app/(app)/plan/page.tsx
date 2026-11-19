import { formatTimeOfDay } from "@/lib/format";
import { addDays, toLocalDate } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { DayPlan, type PlanItem } from "@/components/day-plan";
import { leftForToday, planCandidates, ritualFor, suggestTop3 } from "@/lib/day-plan";
import type { TaskRecord } from "@/lib/tasks/view";
import { loadTaskData } from "../tasks/data";
import { loadSchedule } from "../schedule-data";

/**
 * /plan: Morning Plan and Evening Shutdown. Opens on the one that fits the
 * time of day (morning before noon, shutdown from 5 PM); tabs switch.
 */
export default async function PlanPage() {
  const data = await loadTaskData();
  const { timeZone } = data.settings;
  const today = toLocalDate(data.now, timeZone);
  const supabase = await createClient();
  const [classesOn, { data: plan }] = await Promise.all([
    loadSchedule(),
    supabase.from("day_plans").select("focus_task_ids, intention, planned_at, shutdown_at").eq("on_date", today).maybeSingle(),
  ]);

  const item = (t: TaskRecord): PlanItem => {
    const v = data.view(t);
    return { id: t.id, title: v.displayTitle, dueText: v.dueText, overdue: v.tone === "overdue", color: v.classColor };
  };
  const dayOf = (t: TaskRecord) => (t.due_at ? toLocalDate(new Date(t.due_at), timeZone) : null);
  const focus = plan?.focus_task_ids ?? [];
  const ritual = ritualFor(data.now, timeZone);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Plan" subtitle={ritual === "evening" ? "Wrap up the day" : "Set up your day"} />
      <DayPlan
        start={ritual === "evening" ? "evening" : "morning"}
        classes={classesOn(today).map((c) => ({ name: c.name, color: c.color, time: formatTimeOfDay(c.starts_at) }))}
        candidates={planCandidates(data.open, data.now, timeZone).map(item)}
        suggested={suggestTop3(data.open, data.now, timeZone)}
        plannedFocus={plan?.planned_at ? focus : null}
        intention={plan?.intention ?? null}
        left={leftForToday(data.open, focus, data.now, timeZone).map(item)}
        doneToday={data.recentlyDone.filter((t) => t.completed_at && toLocalDate(new Date(t.completed_at), timeZone) === today).length}
        dueToday={data.open.filter((t) => { const d = dayOf(t); return d !== null && d <= today; }).length}
        dueTomorrow={data.open.filter((t) => dayOf(t) === addDays(today, 1)).length}
        shutDown={Boolean(plan?.shutdown_at)}
      />
    </div>
  );
}
