-- Add heading column for [T] group tags from bulk import.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

alter table public.questions
add column if not exists heading text;

create index if not exists questions_heading_idx on public.questions (heading);
