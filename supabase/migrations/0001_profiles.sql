-- 0001: profiles (one row per user) + shared helpers.
-- See docs/07-architecture.md §4.1 and §5.
-- Run once in Supabase → SQL Editor. Safe to read top to bottom.

-- Keeps updated_at current on any table that has the column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  timezone text not null default 'America/Phoenix',
  -- Study minutes per weekday, Sunday first. Default: 2 hours Mon–Fri.
  study_minutes int[] not null default '{0,120,120,120,120,120,0}',
  study_end_time time not null default '22:00',
  -- Capture types that may skip the Inbox (empty = everything gets reviewed).
  auto_save_types text[] not null default '{}',
  xp_total int not null default 0,
  coins int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_minutes_has_7_days check (array_length(study_minutes, 1) = 7)
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Row Level Security: you can only see and change your own profile.
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Create the profile automatically when someone signs up.
-- "security definer" lets this trigger insert even though the new user
-- isn't logged in yet; it only ever inserts a row for that new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
