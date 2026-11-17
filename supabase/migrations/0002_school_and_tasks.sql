-- 0002: school schedule, classes, tasks/assignments, time blocks, events.
-- See docs/07-architecture.md §4.2–4.3 and §5.
-- Run once in Supabase → SQL Editor, after 0001.

-- Every table below follows the same pattern:
--   user_id  → whose row it is (filled in automatically from your login)
--   RLS      → you can only read/write your own rows
--   deleted_at → soft delete for the 7-day Trash (tables people delete from)

-- ── Terms & days off ─────────────────────────────────────────────────────
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint term_dates_in_order check (ends_on >= starts_on)
);

create table public.no_school_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  term_id uuid not null references public.terms on delete cascade,
  date date not null,
  label text,
  created_at timestamptz not null default now(),
  unique (term_id, date)
);

-- ── Schedule (one per term) ─────────────────────────────────────────────
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  term_id uuid not null unique references public.terms on delete cascade,
  kind text not null default 'weekly' check (kind in ('weekly', 'rotating')),
  school_weekdays int[] not null default '{1,2,3,4}', -- Ethan: Mon–Thu
  day_labels text[] not null default '{}',             -- e.g. {A,B}
  anchor_date date,                                     -- a day whose label you know
  anchor_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rotating_needs_anchor check (
    kind = 'weekly'
    or (cardinality(day_labels) > 0 and anchor_date is not null and anchor_label = any (day_labels))
  )
);

create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  schedule_id uuid not null references public.schedules on delete cascade,
  date date not null,
  no_school boolean not null default false,
  label text,
  note text,
  created_at timestamptz not null default now(),
  unique (schedule_id, date)
);

-- ── Classes ──────────────────────────────────────────────────────────────
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  term_id uuid references public.terms on delete set null,
  name text not null,
  short_names text[] not null default '{}', -- nicknames for quick add: {bio}
  color text not null default '#6b7280',
  teacher text,
  room text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  weekday int check (weekday between 0 and 6), -- weekly schedules
  day_label text,                                -- rotating schedules
  starts_at time not null,
  ends_at time not null,
  room text,
  created_at timestamptz not null default now(),
  constraint meeting_has_day check (weekday is not null or day_label is not null),
  constraint meeting_times_in_order check (ends_at > starts_at)
);

-- ── Tasks & assignments (an assignment = a task with a class) ────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  kind text not null default 'task' check (kind in ('task', 'assignment', 'exam', 'project')),
  class_id uuid references public.classes on delete set null,
  notes text,
  due_at timestamptz,
  due_has_time boolean not null default false,
  estimate_minutes int check (estimate_minutes is null or estimate_minutes >= 0),
  minutes_done int not null default 0 check (minutes_done >= 0),
  priority int not null default 2 check (priority between 1 and 3),
  status text not null default 'open' check (status in ('open', 'done')),
  completed_at timestamptz,
  repeat jsonb,                 -- see src/lib/repeat
  series_id uuid,               -- links the copies of a repeating task
  nag_level text not null default 'gentle' check (nag_level in ('off', 'gentle', 'persistent')),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_open_by_due on public.tasks (user_id, due_at) where status = 'open' and deleted_at is null;

-- "Do date": a task dragged onto the calendar.
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid references public.tasks on delete cascade,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint block_times_in_order check (ends_at > starts_at)
);

create index time_blocks_by_start on public.time_blocks (user_id, starts_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  category text not null default 'personal',
  repeat jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint event_times_in_order check (ends_at >= starts_at)
);

create index events_by_start on public.events (user_id, starts_at) where deleted_at is null;

-- ── updated_at triggers ──────────────────────────────────────────────────
create trigger terms_updated_at before update on public.terms for each row execute function public.set_updated_at();
create trigger schedules_updated_at before update on public.schedules for each row execute function public.set_updated_at();
create trigger classes_updated_at before update on public.classes for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger time_blocks_updated_at before update on public.time_blocks for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();

-- ── Row Level Security: "only my own rows", same rule on every table ─────
do $$
declare
  t text;
begin
  foreach t in array array[
    'terms', 'no_school_days', 'schedules', 'schedule_overrides',
    'classes', 'class_meetings', 'tasks', 'time_blocks', 'events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end;
$$;
