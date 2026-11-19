-- 0015: look-and-feel choices from the design gallery (/gallery).
alter table public.profiles
  add column if not exists theme text not null default 'neon-teal',
  add column if not exists liked_layouts text[] not null default '{}';
