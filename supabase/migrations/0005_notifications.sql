-- 0005: push notifications ("the dashboard talks to me").
-- See docs/07-architecture.md §12–13 and the roadmap's "Requested next".

-- Each device that turned notifications on (your installed iPhone app).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

alter table public.push_subscriptions enable row level security;
create policy "own rows" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What was already sent, so a reminder never goes out twice.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,          -- 'morning', 'evening', 'due:<task id>'
  local_date date not null,    -- the day in your time zone
  sent_at timestamptz not null default now(),
  unique (user_id, kind, local_date)
);

alter table public.notification_log enable row level security;
create policy "read own" on public.notification_log for select using (user_id = auth.uid());

-- Your reminder times.
alter table public.profiles
  add column notify_morning time not null default '07:00',
  add column notify_evening time not null default '20:00';

-- ── The scheduler: every 15 minutes, ask the app to send what's due ─────
-- pg_net lets the database call a web address; pg_cron runs it on a timer.
-- The shared secret lives in Supabase Vault (encrypted), not in this file.
create extension if not exists pg_net;

create or replace function public.notify_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://ethan-s-personal-dashboard.vercel.app/api/cron/tick',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 15000
  );
end;
$$;

revoke execute on function public.notify_tick() from public, anon, authenticated;

select cron.schedule('notify-tick', '*/15 * * * *', $$select public.notify_tick()$$);
