-- 0011: journal (one entry per day, with a mood). See docs/07-architecture.md §4.6.

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  mood int check (mood between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, on_date)
);

create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

alter table public.journal_entries enable row level security;
create policy "own rows" on public.journal_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
