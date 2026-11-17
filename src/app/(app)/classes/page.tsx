import { createClient } from "@/lib/supabase/server";
import { formatTimeOfDay, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/format";
import { Button, Card, ColorDot, EmptyState, ErrorBanner, Field, Input, PageHeader, Select } from "@/components/ui";
import { deleteClass, saveClass, saveTerm } from "./actions";
import Link from "next/link";

type Meeting = { id: string; class_id: string; weekday: number | null; starts_at: string; ends_at: string };
type ClassRow = {
  id: string;
  name: string;
  short_names: string[];
  color: string;
  teacher: string | null;
  room: string | null;
};

export default async function ClassesPage({ searchParams }: PageProps<"/classes">) {
  const { error: formError } = await searchParams;
  const supabase = await createClient();

  const { data: term } = await supabase
    .from("terms")
    .select("id, name, starts_on, ends_on, schedules(school_weekdays)")
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: classes }, { data: meetings }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, short_names, color, teacher, room")
      .is("deleted_at", null)
      .eq("archived", false)
      .order("name"),
    supabase.from("class_meetings").select("id, class_id, weekday, starts_at, ends_at").order("weekday").order("starts_at"),
  ]);

  const schoolWeekdays = term?.schedules?.school_weekdays ?? [1, 2, 3, 4];
  const meetingsByClass = new Map<string, Meeting[]>();
  for (const m of meetings ?? []) {
    meetingsByClass.set(m.class_id, [...(meetingsByClass.get(m.class_id) ?? []), m]);
  }
  // Show classes in the order they meet during the week.
  const sorted = [...(classes ?? [])].sort((a, b) => firstMeetingKey(meetingsByClass.get(a.id)) - firstMeetingKey(meetingsByClass.get(b.id)));

  // Week at a glance: each school day with its classes in time order.
  const week = schoolWeekdays
    .slice()
    .sort((a, b) => a - b)
    .map((wd) => ({
      wd,
      items: sorted
        .flatMap((c) => (meetingsByClass.get(c.id) ?? []).filter((m) => m.weekday === wd).map((m) => ({ c, m })))
        .sort((a, b) => a.m.starts_at.localeCompare(b.m.starts_at)),
    }));

  return (
    <div className="stagger flex flex-col gap-5">
      <PageHeader title="Classes" subtitle={term?.name ?? "Your schedule"} />
      {typeof formError === "string" && <ErrorBanner message={formError} path="/classes" />}

      <Card title="Week at a glance">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {week.map(({ wd, items }) => (
            <div key={wd} className="rounded-2xl border border-line bg-raised/70 p-3">
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{WEEKDAY_SHORT[wd]}</p>
              {items.length === 0 ? (
                <p className="text-xs text-faint">No classes</p>
              ) : (
                <ul className="rows flex flex-col gap-2">
                  {items.map(({ c, m }) => (
                    <li key={m.id} className="border-l-2 pl-2" style={{ borderColor: c.color }}>
                      <p className="text-sm leading-tight font-medium">{c.name}</p>
                      <p className="text-[11px] text-faint">{formatTimeOfDay(m.starts_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Your classes">
        {sorted.length === 0 && <EmptyState>No classes yet. Add one below.</EmptyState>}
        <ul className="rows flex flex-col gap-2">
          {sorted.map((c) => (
            <ClassItem key={c.id} cls={c} meetings={meetingsByClass.get(c.id) ?? []} />
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-accent">+ Add a class</summary>
          <div className="mt-3">
            <ClassForm termId={term?.id ?? ""} meetings={[]} />
          </div>
        </details>
      </Card>

      {term && (
        <details className="rounded-2xl border border-line bg-surface/60 p-4">
          <summary className="cursor-pointer text-xs font-semibold tracking-[0.16em] text-muted uppercase">Term settings</summary>
          <form action={saveTerm} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="id" value={term.id} />
            <Field label="Name">
              <Input name="name" defaultValue={term.name} required />
            </Field>
            <Field label="First day">
              <Input name="starts_on" type="date" defaultValue={term.starts_on} required />
            </Field>
            <Field label="Last day">
              <Input name="ends_on" type="date" defaultValue={term.ends_on} required />
            </Field>
            <fieldset className="sm:col-span-3">
              <legend className="mb-2 text-xs font-medium tracking-wide text-muted">School days</legend>
              <div className="flex flex-wrap gap-3">
                {WEEKDAY_SHORT.map((d, i) => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="school_weekdays" value={i} defaultChecked={schoolWeekdays.includes(i)} className="accent-[var(--color-accent)]" />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-3">
              <Button type="submit">Save term</Button>
            </div>
          </form>
        </details>
      )}

      <Link href="/settings" className="self-center rounded-xl px-4 py-2 text-sm text-muted hover:text-ink md:hidden">
        Settings · connections · sign out
      </Link>
    </div>
  );
}

function firstMeetingKey(meetings: Meeting[] | undefined): number {
  const m = meetings?.[0];
  if (!m) return 99999;
  const [h, min] = m.starts_at.split(":").map(Number);
  return (m.weekday ?? 9) * 1440 + h * 60 + min;
}

function ClassItem({ cls, meetings }: { cls: ClassRow; meetings: Meeting[] }) {
  return (
    <li className="rounded-2xl border border-line bg-raised/70 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-1.5">
          <ColorDot color={cls.color} />
        </span>
        <div className="flex-1">
          <div className="font-medium">{cls.name}</div>
          <div className="text-sm text-muted">
            {meetings.length > 0
              ? meetings
                  .map((m) => `${m.weekday != null ? WEEKDAY_SHORT[m.weekday] : "?"} ${formatTimeOfDay(m.starts_at)}–${formatTimeOfDay(m.ends_at)}`)
                  .join(", ")
              : "No class times yet"}
          </div>
          {cls.short_names.length > 0 && (
            <div className="text-xs text-faint">Quick-add nicknames: {cls.short_names.join(", ")}</div>
          )}
        </div>
      </div>
      <details className="mt-2 ml-6">
        <summary className="cursor-pointer text-sm text-muted">Edit</summary>
        <div className="mt-3 flex flex-col gap-3">
          <ClassForm cls={cls} meetings={meetings} />
          <form action={deleteClass}>
            <input type="hidden" name="id" value={cls.id} />
            <Button variant="danger" type="submit">
              Delete class
            </Button>
          </form>
        </div>
      </details>
    </li>
  );
}

function ClassForm({ cls, meetings, termId }: { cls?: ClassRow; meetings: Meeting[]; termId?: string }) {
  // Existing class times, plus one blank row for adding another.
  const rows = [...meetings, null];
  return (
    <form action={saveClass} className="flex flex-col gap-3">
      {cls && <input type="hidden" name="id" value={cls.id} />}
      {!cls && <input type="hidden" name="term_id" value={termId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={cls?.name} required />
        </Field>
        <Field label="Nicknames for quick add" hint="Separate with commas, e.g. anatomy, anat">
          <Input name="short_names" defaultValue={cls?.short_names.join(", ")} />
        </Field>
        <Field label="Teacher (optional)">
          <Input name="teacher" defaultValue={cls?.teacher ?? ""} />
        </Field>
        <Field label="Room (optional)">
          <Input name="room" defaultValue={cls?.room ?? ""} />
        </Field>
        <Field label="Color">
          <Input name="color" type="color" defaultValue={cls?.color ?? "#6b7280"} className="h-9 w-16 p-1" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-muted">Class times</legend>
        {rows.map((m, i) => (
          <div key={m?.id ?? "new"} className="flex flex-wrap items-center gap-2 text-sm">
            {m && <input type="hidden" name={`m_${i}_id`} value={m.id} />}
            <Select name={`m_${i}_weekday`} defaultValue={m?.weekday ?? ""} aria-label="Day">
              <option value="">{m ? "Day" : "Add a time…"}</option>
              {WEEKDAY_LONG.map((d, wd) => (
                <option key={d} value={wd}>
                  {d}
                </option>
              ))}
            </Select>
            <Input name={`m_${i}_start`} type="time" defaultValue={m?.starts_at.slice(0, 5)} aria-label="Starts" />
            <span>to</span>
            <Input name={`m_${i}_end`} type="time" defaultValue={m?.ends_at.slice(0, 5)} aria-label="Ends" />
            {m && (
              <label className="flex items-center gap-1 text-muted">
                <input type="checkbox" name={`m_${i}_remove`} /> remove
              </label>
            )}
          </div>
        ))}
      </fieldset>
      <div>
        <Button type="submit">{cls ? "Save changes" : "Add class"}</Button>
      </div>
    </form>
  );
}
