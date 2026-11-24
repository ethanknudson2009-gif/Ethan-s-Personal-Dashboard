-- 0022: the full food tracker. Macros per item, meals, servings, photos,
-- foods you saved yourself (recipes, barcodes), and macro goals.

-- ── Each thing you ate: macros, which meal, how much, where it came from ──
alter table public.food_entries
  alter column protein_g type numeric(6,1),
  add column if not exists meal text check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  add column if not exists serving text check (serving is null or char_length(serving) <= 60),
  add column if not exists grams numeric(7,1) check (grams is null or grams between 0 and 20000),
  add column if not exists carbs_g numeric(6,1) check (carbs_g is null or carbs_g between 0 and 2000),
  add column if not exists fat_g numeric(6,1) check (fat_g is null or fat_g between 0 and 2000),
  add column if not exists fiber_g numeric(6,1) check (fiber_g is null or fiber_g between 0 and 500),
  add column if not exists sugar_g numeric(6,1) check (sugar_g is null or sugar_g between 0 and 2000),
  -- Which library food it matched ("egg"), or a saved food's id, so it can be re-scaled later.
  add column if not exists food_key text check (food_key is null or char_length(food_key) <= 120),
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'voice', 'photo', 'barcode', 'library', 'claude', 'copy')),
  add column if not exists photo_id uuid,
  add column if not exists eaten_at timestamptz not null default now();

-- Old rows: protein had to be a whole number; keep the same check, now with decimals.
alter table public.food_entries drop constraint if exists food_entries_protein_g_check;
alter table public.food_entries add constraint food_entries_protein_g_check check (protein_g is null or protein_g between 0 and 1000);

-- ── Meal photos waiting for Claude (taken in the app, read through the connector) ──
create table if not exists public.food_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  meal text check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  storage_path text not null,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'waiting' check (status in ('waiting', 'logged', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists food_photos_by_status on public.food_photos (user_id, status, created_at desc);
alter table public.food_photos enable row level security;
create policy "own rows" on public.food_photos for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.food_entries
  add constraint food_entries_photo_fk foreign key (photo_id) references public.food_photos (id) on delete set null;

-- ── Foods you saved: your own recipes ("my protein shake"), barcode lookups ──
create table if not exists public.my_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  aliases text[] not null default '{}',
  serving text not null default '1 serving' check (char_length(serving) <= 60),
  grams numeric(7,1) check (grams is null or grams between 0 and 20000),
  calories int not null check (calories between 0 and 10000),
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  fiber_g numeric(6,1),
  sugar_g numeric(6,1),
  barcode text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  brand text check (brand is null or char_length(brand) <= 80),
  created_at timestamptz not null default now(),
  unique (user_id, barcode)
);
create index if not exists my_foods_by_user on public.my_foods (user_id, name);
alter table public.my_foods enable row level security;
create policy "own rows" on public.my_foods for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Macro goals next to the calorie goal ──
alter table public.profiles
  add column if not exists protein_goal int check (protein_goal is null or protein_goal between 10 and 500),
  add column if not exists carbs_goal int check (carbs_goal is null or carbs_goal between 10 and 1500),
  add column if not exists fat_goal int check (fat_goal is null or fat_goal between 10 and 500),
  add column if not exists body_weight_lb numeric(5,1) check (body_weight_lb is null or body_weight_lb between 60 and 600),
  add column if not exists food_plan text check (food_plan in ('cut', 'maintain', 'bulk'));
