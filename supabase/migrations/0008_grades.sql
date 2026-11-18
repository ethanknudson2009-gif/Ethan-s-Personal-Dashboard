-- 0008: grades (weighted categories + what-if). See docs/07-architecture.md §4.2.

create table public.grade_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  name text not null,
  weight numeric not null check (weight >= 0 and weight <= 100),
  created_at timestamptz not null default now()
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  class_id uuid not null references public.classes on delete cascade,
  category_id uuid references public.grade_categories on delete set null,
  task_id uuid references public.tasks on delete set null,
  title text not null,
  points_earned numeric not null check (points_earned >= 0),
  points_possible numeric not null check (points_possible > 0),
  is_what_if boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.grade_categories enable row level security;
alter table public.grades enable row level security;
create policy "own rows" on public.grade_categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.grades for all using (user_id = auth.uid()) with check (user_id = auth.uid());
