import { Card, EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { TaskForm, TaskRow } from "@/components/tasks";
import { groupByDue, loadTaskData } from "./data";

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const { error: formError } = await searchParams;
  const data = await loadTaskData();
  const { timeZone } = data.settings;
  const buckets = groupByDue(data.open, data.now, timeZone);

  const row = (t: (typeof data.open)[number]) => (
    <TaskRow
      key={t.id}
      task={t}
      cls={t.class_id ? (data.classById.get(t.class_id) ?? null) : null}
      cushion={data.cushions.get(t.id)}
      now={data.now}
      timeZone={timeZone}
      classes={data.classes}
      back="/tasks"
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Tasks & assignments" />
      {typeof formError === "string" && <ErrorBanner message={formError} path="/tasks" />}

      <Card>
        <details>
          <summary className="cursor-pointer font-semibold">+ Add a task or assignment</summary>
          <div className="mt-3">
            <TaskForm classes={data.classes} timeZone={timeZone} back="/tasks" />
          </div>
        </details>
      </Card>

      {buckets.length === 0 && <EmptyState>Nothing to do. Add something above.</EmptyState>}
      {buckets.map((b) => (
        <Card key={b.key} title={`${b.title} (${b.tasks.length})`}>
          <ul className="divide-y divide-gray-100">{b.tasks.map(row)}</ul>
        </Card>
      ))}

      {data.recentlyDone.length > 0 && (
        <Card title="Done in the last 7 days">
          <ul className="divide-y divide-gray-100">{data.recentlyDone.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}
