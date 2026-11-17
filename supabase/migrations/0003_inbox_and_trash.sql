-- 0003: Inbox (review-before-save) and the 7-day Trash cleanup.
-- See docs/07-architecture.md §4.4, §8 and §13.

-- ── Inbox ────────────────────────────────────────────────────────────────
-- Captures from the iPhone Shortcut, Claude, or a syllabus land here first.
-- You approve (it becomes a real task), edit, or dismiss each one.
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  raw_text text not null,
  draft jsonb not null default '{}',     -- the proposed record (see src/lib/capture)
  type text not null default 'task',
  confidence real not null default 0 check (confidence between 0 and 1),
  problems text[] not null default '{}', -- plain-language reasons to double-check
  source text not null default 'shortcut',
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  result_table text,
  result_id uuid,
  batch_id uuid,                          -- groups a syllabus import
  client_id text,                         -- lets a retried send be ignored
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, client_id)
);

create index inbox_pending on public.inbox_items (user_id, created_at) where status = 'pending' and deleted_at is null;

create trigger inbox_items_updated_at before update on public.inbox_items
  for each row execute function public.set_updated_at();

alter table public.inbox_items enable row level security;
create policy "own rows" on public.inbox_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Trash: permanently remove things deleted more than 7 days ago ───────
create or replace function public.purge_trash()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.tasks        where deleted_at < now() - interval '7 days';
  delete from public.events       where deleted_at < now() - interval '7 days';
  delete from public.classes      where deleted_at < now() - interval '7 days';
  delete from public.inbox_items  where deleted_at < now() - interval '7 days';
  -- Handled inbox items aren't needed after a month.
  delete from public.inbox_items  where status <> 'pending' and updated_at < now() - interval '30 days';
$$;

-- Only the scheduler may run it: not callable from the website or the API.
revoke execute on function public.purge_trash() from public, anon, authenticated;

-- Supabase's built-in scheduler (free). Every day at 10:00 UTC = 3:00 AM Phoenix.
create extension if not exists pg_cron;
select cron.schedule('purge-trash', '0 10 * * *', $$select public.purge_trash()$$);
