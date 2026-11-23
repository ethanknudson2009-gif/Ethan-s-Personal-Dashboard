import { toLocalDate } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui";
import { TaskItem } from "@/components/task-item";
import { AreaActions } from "@/components/area-actions";
import { ProgressRing } from "@/components/progress-ring";
import { groupByDue, loadTaskData } from "../tasks/data";

/**
 * Work: tasks for Ethan's job at PRMI. Same task tools as School (swipe,
 * focus timer, notes), in the Work colors (amber).
 */
export default async function WorkPage() {
  const data = await loadTaskData({ area: "work" });
  const { timeZone } = data.settings;
  const today = toLocalDate(data.now, timeZone);
  const buckets = groupByDue(data.open, data.now, timeZone);
  const urgent = [...(buckets.find((b) => b.key === "overdue")?.tasks ?? []), ...(buckets.find((b) => b.key === "today")?.tasks ?? [])];
  const thisWeek = buckets.filter((b) => b.key === "tomorrow" || b.key === "week").reduce((n, b) => n + b.tasks.length, 0);
  const doneToday = data.recentlyDone.filter((t) => t.completed_at && toLocalDate(new Date(t.completed_at), timeZone) === today).length;
  const doneWeek = data.recentlyDone.length;
  const open = data.open.length;

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Work" subtitle="PRMI" />

      {/* Hero: the work day at a glance */}
      <section className="hero hero-work glow-work rounded-3xl border border-warn/40 bg-surface/70 p-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.18em] text-warn uppercase">💼 PRMI · Today</p>
            <p className="mt-1 font-display text-2xl leading-tight font-semibold text-balance">
              {open === 0 ? "Nothing on your plate." : urgent.length ? `${urgent.length} to handle today` : "You're on top of it."}
            </p>
            <p className="mt-1 text-sm text-muted">
              {open} open · {thisWeek} this week · {doneWeek} done this week
            </p>
          </div>
          <ProgressRing done={doneToday} total={doneToday + urgent.length} color="var(--color-warn)" />
        </div>
        <div className="mt-4">
          <AreaActions area="work" tone="work" />
        </div>
      </section>

      {buckets.length === 0 ? (
        <section className="relative flex flex-col items-center gap-1 overflow-hidden rounded-3xl border border-warn/30 bg-warn/5 px-4 py-8 text-center">
          <span className="twinkle absolute top-4 left-8 text-warn">✦</span>
          <span className="twinkle twinkle-2 absolute top-10 right-10 text-warn">✦</span>
          <p className="font-display text-lg font-semibold text-warn">Inbox zero at work</p>
          <p className="max-w-xs text-sm text-muted">Say something like “PRMI send the loan files to my manager tomorrow” and it lands here.</p>
        </section>
      ) : (
        buckets.map((b) => (
          <Card key={b.key} title={`${b.title} · ${b.tasks.length}`} className={b.key === "overdue" ? "border-danger/40" : b.key === "today" ? "border-warn/40" : undefined}>
            <ul className="rows flex flex-col gap-2">
              {b.tasks.map((t) => (
                <TaskItem key={t.id} task={data.view(t)} />
              ))}
            </ul>
          </Card>
        ))
      )}

      {data.recentlyDone.length > 0 && (
        <details className="group rounded-3xl border border-line bg-surface/60 p-4">
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
    </div>
  );
}
