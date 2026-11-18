-- 0010: window-washing side business: customers and jobs.
-- See docs/07-architecture.md §4.6. Marking a job paid adds the income to Money.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  phone text,
  address text,
  notes text,
  repeat_weeks int check (repeat_weeks is null or repeat_weeks between 1 and 52),
  default_price_cents int check (default_price_cents is null or default_price_cents >= 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  customer_id uuid not null references public.customers on delete cascade,
  scheduled_on date not null,
  scheduled_time time,
  price_cents int not null default 0 check (price_cents >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'paid')),
  notes text,
  money_id uuid references public.money_transactions on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index jobs_by_date on public.jobs (user_id, scheduled_on) where deleted_at is null;

alter table public.customers enable row level security;
alter table public.jobs enable row level security;
create policy "own rows" on public.customers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.jobs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
