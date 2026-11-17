import { Card, EmptyState, PageHeader } from "@/components/ui";
import { TaskItem } from "@/components/task-item";
import { AddButton } from "@/components/add-button";
import Link from "next/link";
import { groupByDue, loadTaskData } from "./data";

/** School: every task and assignment, grouped by when it's due. */
export default async function SchoolPage() {
  const data = await loadTaskData();
  const { timeZone } = data.settings;
  const buckets = groupByDue(data.open, data.now, timeZone);
  const overdue = buckets.find((b) => b.key === "overdue")?.tasks.length ?? 0;
  const thisWeek = buckets
    .filter((b) => ["today", "tomorrow", "week"].includes(b.key))
    .reduce((n, b) => n + b.tasks.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="School" subtitle="Assignments & tasks">
        <AddButton />
      </PageHeader>

      {/* Summary card (reference image 1: one bold card up top) */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/20 via-electric/10 to-transparent p-5 shadow-glow">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-accent uppercase">This week</p>
            <p className="font-display text-4xl font-semibold">{thisWeek}</p>
            <p className="text-sm text-muted">{thisWeek === 1 ? "thing due" : "things due"} in the next 7 days</p>
          </div>
          {overdue > 0 && (
            <div className="rounded-2xl border border-danger/40 bg-danger/10 px-3 py-2 text-right shadow-glow-danger">
              <p className="font-display text-2xl font-semibold text-danger">{overdue}</p>
              <p className="text-xs text-danger">overdue</p>
            </div>
          )}
        </div>
      </section>

      {buckets.length === 0 && <EmptyState>All clear. Tap + to add your next assignment.</EmptyState>}
      {buckets.map((b) => (
        <Card key={b.key} title={`${b.title} · ${b.tasks.length}`}>
          <ul className="flex flex-col gap-2">
            {b.tasks.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </Card>
      ))}

      {data.recentlyDone.length > 0 && (
        <details className="group rounded-2xl border border-line bg-surface/60 p-4">
          <summary className="cursor-pointer list-none text-xs font-semibold tracking-[0.16em] text-muted uppercase">
            Done this week · {data.recentlyDone.length} <span className="text-faint group-open:hidden">(show)</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentlyDone.map((t) => (
              <TaskItem key={t.id} task={data.view(t)} />
            ))}
          </ul>
        </details>
      )}

      <Link href="/trash" className="self-center text-xs text-faint hover:text-muted md:hidden">
        Trash (deleted items, kept 7 days)
      </Link>
    </div>
  );
}
