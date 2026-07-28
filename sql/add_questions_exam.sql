-- Add exam column to tag questions with the exam they were asked in.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

alter table public.questions
add column if not exists exam text;

create index if not exists questions_exam_idx on public.questions (exam);
