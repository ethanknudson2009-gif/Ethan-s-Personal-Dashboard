-- 0004: private tokens for the iPhone "Log It" Shortcut and the Claude
-- connector. See docs/07-architecture.md §4.1, §6 and §10.
--
-- The real token is shown to you once when you create it. Only its SHA-256
-- fingerprint is stored, so even someone reading the database can't use it.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  scope text not null check (scope in ('capture', 'mcp')),
  token_hash text not null unique,
  token_hint text not null,          -- last 4 characters, to tell tokens apart
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.api_tokens enable row level security;

-- You can see, create and revoke your own tokens from Settings.
create policy "own rows" on public.api_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
