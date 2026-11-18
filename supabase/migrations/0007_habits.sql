-- 0007: habits (the Life tab). See docs/07-architecture.md §4.6.

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text,
  color text not null default '#2ee6c9',
  target_times int not null default 1 check (target_times between 1 and 14),
  target_per text not null default 'day' check (target_per in ('day', 'week')),
  started_on date not null default current_date,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.habit_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references public.habits on delete cascade,
  on_date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, on_date)
);

create index habit_checkins_recent on public.habit_checkins (user_id, on_date);

alter table public.habits enable row level security;
alter table public.habit_checkins enable row level security;
create policy "own rows" on public.habits for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.habit_checkins for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deleted habits are cleared after 7 days with the rest of the Trash.
create or replace function public.purge_trash()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.tasks        where deleted_at < now() - interval '7 days';
  delete from public.events       where deleted_at < now() - interval '7 days';
  delete from public.classes      where deleted_at < now() - interval '7 days';
  delete from public.habits       where deleted_at < now() - interval '7 days';
  delete from public.inbox_items  where deleted_at < now() - interval '7 days';
  delete from public.inbox_items  where status <> 'pending' and updated_at < now() - interval '30 days';
$$;
revoke execute on function public.purge_trash() from public, anon, authenticated;
