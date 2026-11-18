import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { daysUntil } from "@/lib/format";
import { toTaskView, type TaskRecord, type TaskView } from "@/lib/tasks/view";
import type { StudySettings } from "@/lib/cushion";

const TASK_COLUMNS = "id, title, class_id, due_at, due_has_time, status, repeat, completed_at, minutes_done, notes, area";

export type ClassInfo = { id: string; name: string; color: string };

export type TaskData = {
  open: TaskRecord[];
  recentlyDone: TaskRecord[];
  classById: Map<string, ClassInfo>;
  settings: StudySettings;
  now: Date;
  view: (t: TaskRecord) => TaskView;
};

/** Everything the Today and School pages need, loaded in parallel. */
export async function loadTaskData(only?: { area?: "work"; notArea?: "work" }): Promise<TaskData> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [settings, openRes, doneRes, classRes] = await Promise.all([
    loadSettings(supabase),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("status", "done")
      .is("deleted_at", null)
      .gte("completed_at", weekAgo)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase.from("classes").select("id, name, color").is("deleted_at", null).eq("archived", false),
  ]);

  const now = new Date();
  const classById = new Map((classRes.data ?? []).map((c) => [c.id, c]));
  const keep = (t: { area?: string | null }) =>
    only?.area ? t.area === only.area : only?.notArea ? t.area !== only.notArea : true;
  return {
    open: (openRes.data ?? []).filter(keep),
    recentlyDone: (doneRes.data ?? []).filter(keep),
    classById,
    settings,
    now,
    view: (t) => toTaskView(t, t.class_id ? (classById.get(t.class_id) ?? null) : null, now, settings.timeZone),
  };
}

export type Bucket = { key: string; title: string; tasks: TaskRecord[] };

/** Groups open tasks: Overdue, Today, Tomorrow, This week, Later, No due date. */
export function groupByDue(tasks: TaskRecord[], now: Date, timeZone: string): Bucket[] {
  const buckets: Bucket[] = [
    { key: "overdue", title: "Overdue", tasks: [] },
    { key: "today", title: "Today", tasks: [] },
    { key: "tomorrow", title: "Tomorrow", tasks: [] },
    { key: "week", title: "This week", tasks: [] },
    { key: "later", title: "Later", tasks: [] },
    { key: "none", title: "Someday", tasks: [] },
  ];
  const get = (key: string) => buckets.find((b) => b.key === key)!;
  for (const t of tasks) {
    if (!t.due_at) {
      get("none").tasks.push(t);
      continue;
    }
    const due = new Date(t.due_at);
    const days = daysUntil(due, now, timeZone);
    if (due.getTime() < now.getTime()) get("overdue").tasks.push(t);
    else if (days <= 0) get("today").tasks.push(t);
    else if (days === 1) get("tomorrow").tasks.push(t);
    else if (days <= 7) get("week").tasks.push(t);
    else get("later").tasks.push(t);
  }
  return buckets.filter((b) => b.tasks.length > 0);
}

/** Number of things that need attention now: overdue + due today. */
export function attentionCount(tasks: TaskRecord[], now: Date, timeZone: string): number {
  return tasks.filter((t) => t.due_at && daysUntil(new Date(t.due_at), now, timeZone) <= 0).length;
}
