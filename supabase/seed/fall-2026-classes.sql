-- Ethan's Fall 2026 classes (docs/08-my-schedule-and-ui-wishes.md).
-- Run once in the SQL editor (or `supabase db query -f`). Safe to re-run:
-- it does nothing if the term already exists.
--
-- PLACEHOLDERS to correct on the Classes page:
--   term dates (Aug 10 – Dec 18, 2026)
--   morning = 8:00–11:30, afternoon = 12:30–15:30
do $$
declare
  uid uuid;
  term uuid;
  c uuid;
  rec record;
begin
  -- This project has exactly one account (sign-ups are closed).
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected exactly one user, found %', (select count(*) from auth.users);
  end if;
  select id into uid from auth.users;

  if exists (select 1 from public.terms where user_id = uid and name = 'Fall 2026') then
    raise notice 'Fall 2026 already exists, nothing to do';
    return;
  end if;

  insert into public.terms (user_id, name, starts_on, ends_on)
  values (uid, 'Fall 2026', '2026-08-10', '2026-12-18')
  returning id into term;

  insert into public.schedules (user_id, term_id, kind, school_weekdays)
  values (uid, term, 'weekly', '{1,2,3,4}');

  for rec in
    select * from (values
      ('World History',   '{"world history"}'::text[],     '#2563eb', 1, '08:00'::time, '11:30'::time),
      ('Choir',           '{}'::text[],                    '#db2777', 1, '12:30', '15:30'),
      ('Human Anatomy',   '{anatomy,anat}'::text[],        '#dc2626', 2, '08:00', '11:30'),
      ('AI Mastermind',   '{ai,"ai mastermind"}'::text[],  '#7c3aed', 2, '12:30', '15:30'),
      ('College Algebra', '{algebra,math}'::text[],        '#059669', 3, '08:00', '11:30'),
      ('Speech',          '{}'::text[],                    '#ea580c', 3, '12:30', '15:30'),
      ('AutoCAD',         '{cad,autocad}'::text[],         '#0891b2', 4, '08:00', '11:30'),
      ('Church History',  '{"church history"}'::text[],    '#a16207', 4, '12:30', '15:30')
    ) as t(name, short_names, color, weekday, starts_at, ends_at)
  loop
    insert into public.classes (user_id, term_id, name, short_names, color)
    values (uid, term, rec.name, rec.short_names, rec.color)
    returning id into c;

    insert into public.class_meetings (user_id, class_id, weekday, starts_at, ends_at)
    values (uid, c, rec.weekday, rec.starts_at, rec.ends_at);
  end loop;
end;
$$;
