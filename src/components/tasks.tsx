/**
 * Task row + task form, shared by the Tasks and Today pages.
 * Plain styling for now; the check-off animation and highlights from
 * docs/09-design-direction.md get added here in the design phase.
 */
import { completeTask, deleteTask, logMinutes, reopenTask, saveTask } from "@/app/(app)/tasks/actions";
import { formatDue, formatTimeOfDay, taskDisplayTitle } from "@/lib/format";
import { formatMinutes, type CushionResult } from "@/lib/cushion";
import { describeRepeat, parseRepeat, presetFromRule, REPEAT_PRESETS } from "@/lib/tasks";
import { toLocalDate, zonedParts } from "@/lib/time";
import { Button, ColorDot, CushionBadge, Field, Input, Select, Textarea } from "@/components/ui";

export type TaskRowData = {
  id: string;
  title: string;
  kind: string;
  class_id: string | null;
  notes: string | null;
  due_at: string | null;
  due_has_time: boolean;
  estimate_minutes: number | null;
  minutes_done: number;
  priority: number;
  status: string;
  repeat: unknown;
  completed_at: string | null;
};

export type ClassOption = { id: string; name: string; color: string };

const KIND_LABEL: Record<string, string> = { assignment: "Assignment", exam: "Test/Exam", project: "Project", task: "Task" };

export function TaskRow({
  task,
  cls,
  cushion,
  now,
  timeZone,
  classes,
  back,
}: {
  task: TaskRowData;
  cls: ClassOption | null;
  cushion?: CushionResult;
  now: Date;
  timeZone: string;
  classes: ClassOption[];
  back: string;
}) {
  const done = task.status === "done";
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = !done && due !== null && due.getTime() < now.getTime();
  const repeat = describeRepeat(parseRepeat(task.repeat));

  return (
    <li className={`py-3 ${overdue ? "border-l-4 border-red-400 pl-2" : ""}`}>
      <div className="flex items-start gap-3">
        <form action={done ? reopenTask : completeTask}>
          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="back" value={back} />
          <button
            type="submit"
            aria-label={done ? "Mark not done" : "Check off"}
            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 text-xs ${
              done ? "border-green-600 bg-green-600 text-white" : "border-gray-400 hover:border-gray-700"
            }`}
          >
            {done ? "✓" : ""}
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 font-medium ${done ? "text-gray-400 line-through" : ""}`}>
            {cls && <ColorDot color={cls.color} />}
            <span className="truncate">{taskDisplayTitle(task.title, cls?.name ?? null)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
            {due && (
              <span className={overdue ? "font-medium text-red-700" : ""}>
                {formatDue(due, task.due_has_time, now, timeZone)}
              </span>
            )}
            {task.estimate_minutes != null && (
              <span>
                {formatMinutes(task.estimate_minutes)}
                {task.minutes_done > 0 && ` · ${formatMinutes(task.minutes_done)} done`}
              </span>
            )}
            {repeat && <span>↻ {repeat}</span>}
            {!done && cushion && (
              <CushionBadge
                label={cushion.label}
                text={
                  cushion.label === "behind"
                    ? `Behind ${formatMinutes(-cushion.minutes)}`
                    : `${cushion.label === "ahead" ? "Ahead" : "Tight"} · ${formatMinutes(cushion.minutes)} spare`
                }
              />
            )}
          </div>
        </div>

        {!done && task.estimate_minutes != null && (
          <form action={logMinutes}>
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="minutes" value="30" />
            <Button variant="ghost" type="submit" title="Log 30 minutes of work">
              +30m
            </Button>
          </form>
        )}
      </div>

      {!done && (
        <details className="mt-2 ml-8">
          <summary className="cursor-pointer text-sm text-gray-500">Edit</summary>
          <div className="mt-3 flex flex-col gap-3">
            <TaskForm task={task} classes={classes} timeZone={timeZone} back={back} />
            <form action={deleteTask}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="back" value={back} />
              <Button variant="danger" type="submit">
                Delete
              </Button>
            </form>
          </div>
        </details>
      )}
    </li>
  );
}

export function TaskForm({
  task,
  classes,
  timeZone,
  back,
}: {
  task?: TaskRowData;
  classes: ClassOption[];
  timeZone: string;
  back: string;
}) {
  const due = task?.due_at ? new Date(task.due_at) : null;
  const dueDate = due ? toLocalDate(due, timeZone) : "";
  const dueTime =
    due && task?.due_has_time
      ? (() => {
          const p = zonedParts(due, timeZone);
          return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
        })()
      : "";
  const { preset, afterDays } = presetFromRule(parseRepeat(task?.repeat));

  return (
    <form action={saveTask} className="grid gap-3 sm:grid-cols-2">
      {task && <input type="hidden" name="id" value={task.id} />}
      <input type="hidden" name="back" value={back} />
      <Field label="Title">
        <Input name="title" defaultValue={task?.title} required placeholder={'"What is Equal" Journal'} />
      </Field>
      <Field label="Class">
        <Select name="class_id" defaultValue={task?.class_id ?? ""}>
          <option value="">No class (personal task)</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type">
        <Select name="kind" defaultValue={task?.kind ?? "assignment"}>
          {Object.entries(KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Estimate (minutes)" hint="How long you think it'll take. Used for the Cushion.">
        <Input name="estimate_minutes" type="number" min={0} step={5} defaultValue={task?.estimate_minutes ?? ""} />
      </Field>
      <Field label="Due date">
        <Input name="due_date" type="date" defaultValue={dueDate} />
      </Field>
      <Field label="Due time (optional)" hint={`Blank = end of day (${formatTimeOfDay("23:59")})`}>
        <Input name="due_time" type="time" defaultValue={dueTime} />
      </Field>
      <Field label="Repeats">
        <Select name="repeat_preset" defaultValue={preset}>
          {REPEAT_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="…how many days after (if that option)">
        <Input name="repeat_after_days" type="number" min={1} defaultValue={afterDays ?? ""} />
      </Field>
      <Field label="Priority">
        <Select name="priority" defaultValue={String(task?.priority ?? 2)}>
          <option value="1">High</option>
          <option value="2">Normal</option>
          <option value="3">Low</option>
        </Select>
      </Field>
      <Field label="Notes (optional)">
        <Textarea name="notes" rows={2} defaultValue={task?.notes ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit">{task ? "Save changes" : "Add"}</Button>
      </div>
    </form>
  );
}
