-- 0009: Work area for tasks (PRMI) and the Money section (Cash App imports).

-- Which part of life a task belongs to.
alter table public.tasks
  add column area text not null default 'school' check (area in ('school', 'work', 'personal'));
update public.tasks set area = 'personal' where class_id is null;

-- Money: one row per transaction. Amounts are in cents (no rounding errors):
-- positive = money in, negative = money out.
create table public.money_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  occurred_on date not null,
  amount_cents bigint not null,
  description text not null default '',
  counterparty text,
  category text not null default 'Other',
  source text not null default 'manual' check (source in ('manual', 'cashapp', 'capture')),
  -- The bank's own id for the transaction, so importing the same statement twice adds nothing.
  external_id text,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, source, external_id)
);

create index money_by_date on public.money_transactions (user_id, occurred_on desc) where deleted_at is null;

alter table public.money_transactions enable row level security;
create policy "own rows" on public.money_transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
