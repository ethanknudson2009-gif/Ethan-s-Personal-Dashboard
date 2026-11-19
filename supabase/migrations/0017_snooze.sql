-- Snooze: "remind me again at …" for one task (Nov 19).
-- While a task is snoozed its other reminders wait; at snoozed_until the
-- phone gets one "⏰" reminder. nag_level (off / gentle / persistent) already
-- exists from 0002 and now controls how many reminders a task gets.
alter table public.tasks add column snoozed_until timestamptz;
