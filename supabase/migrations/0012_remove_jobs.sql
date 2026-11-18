-- 0012: remove the window-washing tables from 0010.
-- Ethan doesn't run a window-washing business (that idea came from early
-- planning); his job is Loan Officer Assistant at PRMI (the Work section).
-- Both tables were empty when this ran.
drop table if exists public.jobs;
drop table if exists public.customers;
