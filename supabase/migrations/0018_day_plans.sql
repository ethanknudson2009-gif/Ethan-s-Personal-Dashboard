-- 0018: Morning Plan / Evening Shutdown. One row per day: the top 3 tasks
-- picked in the morning, a one-line intention, and when the day was shut down.

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  focus_task_ids uuid[] not null default '{}',
  intention text,
  planned_at timestamptz,
  shutdown_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, on_date)
);

create trigger day_plans_updated_at before update on public.day_plans
  for each row execute function public.set_updated_at();

alter table public.day_plans enable row level security;
create policy "own rows" on public.day_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
