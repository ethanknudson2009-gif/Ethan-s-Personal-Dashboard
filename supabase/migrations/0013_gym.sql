-- 0013: gym tracker. See docs/07-architecture.md §4.5.

-- Exercises: a shared starter list (user_id null, read-only for everyone)
-- plus your own custom ones.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade, -- null = built-in
  name text not null,
  muscle text not null default 'other',
  bodyweight boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  name text,
  notes text,
  deleted_at timestamptz
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  exercise_id uuid not null references public.exercises on delete cascade,
  position int not null default 0,
  weight_lb numeric check (weight_lb is null or weight_lb >= 0),
  reps int check (reps is null or reps >= 0),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index workouts_recent on public.workouts (user_id, started_at desc) where deleted_at is null;
create index sets_by_workout on public.workout_sets (workout_id, position);

alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;

create policy "read built-in and own" on public.exercises for select using (user_id is null or user_id = auth.uid());
create policy "add own" on public.exercises for insert with check (user_id = auth.uid());
create policy "change own" on public.exercises for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own" on public.exercises for delete using (user_id = auth.uid());
create policy "own rows" on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.workout_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Starter list (our own list of common exercises).
insert into public.exercises (user_id, name, muscle, bodyweight) values
  (null, 'Bench press', 'chest', false),
  (null, 'Incline dumbbell press', 'chest', false),
  (null, 'Push-ups', 'chest', true),
  (null, 'Chest fly', 'chest', false),
  (null, 'Squat', 'legs', false),
  (null, 'Leg press', 'legs', false),
  (null, 'Romanian deadlift', 'legs', false),
  (null, 'Lunges', 'legs', false),
  (null, 'Leg curl', 'legs', false),
  (null, 'Leg extension', 'legs', false),
  (null, 'Calf raise', 'legs', false),
  (null, 'Deadlift', 'back', false),
  (null, 'Pull-ups', 'back', true),
  (null, 'Lat pulldown', 'back', false),
  (null, 'Barbell row', 'back', false),
  (null, 'Seated cable row', 'back', false),
  (null, 'Overhead press', 'shoulders', false),
  (null, 'Lateral raise', 'shoulders', false),
  (null, 'Rear delt fly', 'shoulders', false),
  (null, 'Bicep curl', 'arms', false),
  (null, 'Hammer curl', 'arms', false),
  (null, 'Tricep pushdown', 'arms', false),
  (null, 'Skull crushers', 'arms', false),
  (null, 'Dips', 'arms', true),
  (null, 'Plank (seconds)', 'core', true),
  (null, 'Crunches', 'core', true),
  (null, 'Hanging leg raise', 'core', true);
