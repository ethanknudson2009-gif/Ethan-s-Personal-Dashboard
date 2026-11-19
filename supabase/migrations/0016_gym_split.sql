-- 0016: gym split rotation (Chest → Back & Biceps → Legs → Shoulders & Triceps).
alter table public.profiles
  add column if not exists gym_split text[] not null default '{"Chest","Back & Biceps","Legs","Shoulders & Triceps"}',
  add column if not exists gym_next int not null default 0;

-- Which split day a workout was, which muscles it hit, and skipped days (kept so history is honest).
alter table public.workouts
  add column if not exists split_day text,
  add column if not exists muscles text[] not null default '{}',
  add column if not exists skipped boolean not null default false;
