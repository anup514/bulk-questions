-- Add created_at to questions and backfill pre-existing rows with yesterday's date.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

alter table public.questions
add column if not exists created_at timestamptz;

update public.questions
set created_at = (current_date - interval '1 day')
where created_at is null;

alter table public.questions
alter column created_at set default now();

alter table public.questions
alter column created_at set not null;
