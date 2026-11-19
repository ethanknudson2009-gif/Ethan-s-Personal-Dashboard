-- 0014: food log (the start of Calories). One row per thing you ate.
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  name text not null,
  calories int check (calories is null or calories between 0 and 10000),
  protein_g int check (protein_g is null or protein_g between 0 and 1000),
  created_at timestamptz not null default now()
);

create index food_by_day on public.food_entries (user_id, on_date);
alter table public.food_entries enable row level security;
create policy "own rows" on public.food_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Daily calorie goal (optional), next to the other settings.
alter table public.profiles add column if not exists calorie_goal int check (calorie_goal is null or calorie_goal between 500 and 10000);
