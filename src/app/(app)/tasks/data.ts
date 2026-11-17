import { createClient } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/profile";
import { cushion, type CushionResult, type StudySettings } from "@/lib/cushion";
import { daysUntil } from "@/lib/format";
import type { ClassOption, TaskRowData } from "@/components/tasks";

const TASK_COLUMNS =
  "id, title, kind, class_id, notes, due_at, due_has_time, estimate_minutes, minutes_done, priority, status, repeat, completed_at";

export type TaskData = {
  open: TaskRowData[];
  recentlyDone: TaskRowData[];
  classes: ClassOption[];
  classById: Map<string, ClassOption>;
  cushions: Map<string, CushionResult>;
  settings: StudySettings;
  now: Date;
};

/** Does this task use study time? (School work, or anything with an estimate.) */
export function countsForCushion(t: TaskRowData): boolean {
  return t.due_at !== null && (t.class_id !== null || t.kind !== "task" || t.estimate_minutes !== null);
}

/** Everything the Tasks and Today pages need, loaded in parallel. */
export async function loadTaskData(): Promise<TaskData> {
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
      .limit(30),
    supabase.from("classes").select("id, name, color").is("deleted_at", null).eq("archived", false).order("name"),
  ]);

  const now = new Date();
  const open = (openRes.data ?? []) as TaskRowData[];
  const classes = classRes.data ?? [];
  const cushions = cushion(
    open.filter(countsForCushion).map((t) => ({
      id: t.id,
      dueAt: new Date(t.due_at!),
      estimateMinutes: t.estimate_minutes,
      minutesDone: t.minutes_done,
    })),
    settings,
    now,
  );

  return {
    open,
    recentlyDone: (doneRes.data ?? []) as TaskRowData[],
    classes,
    classById: new Map(classes.map((c) => [c.id, c])),
    cushions,
    settings,
    now,
  };
}

export type Bucket = { key: string; title: string; tasks: TaskRowData[] };

/** Groups open tasks: Overdue, Today, Tomorrow, This week, Later, No due date. */
export function groupByDue(tasks: TaskRowData[], now: Date, timeZone: string): Bucket[] {
  const buckets: Bucket[] = [
    { key: "overdue", title: "Overdue", tasks: [] },
    { key: "today", title: "Today", tasks: [] },
    { key: "tomorrow", title: "Tomorrow", tasks: [] },
    { key: "week", title: "Next 7 days", tasks: [] },
    { key: "later", title: "Later", tasks: [] },
    { key: "none", title: "No due date", tasks: [] },
  ];
  const get = (key: string) => buckets.find((b) => b.key === key)!;
  for (const t of tasks) {
    if (!t.due_at) {
      get("none").tasks.push(t);
      continue;
    }
    const due = new Date(t.due_at);
    const days = daysUntil(due, now, timeZone);
    if (due.getTime() < now.getTime() && days < 0) get("overdue").tasks.push(t);
    else if (days <= 0) get(due.getTime() < now.getTime() ? "overdue" : "today").tasks.push(t);
    else if (days === 1) get("tomorrow").tasks.push(t);
    else if (days <= 7) get("week").tasks.push(t);
    else get("later").tasks.push(t);
  }
  return buckets.filter((b) => b.tasks.length > 0);
}
