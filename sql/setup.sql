-- Full Supabase schema for bulk-questions.
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
    id uuid primary key default gen_random_uuid(),
    stem text not null,
    difficulty text,
    subject text,
    topics text[],
    heading text,
    index integer,
    created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

drop policy if exists "Allow anon select questions" on public.questions;
create policy "Allow anon select questions"
on public.questions for select to anon using (true);

drop policy if exists "Allow anon insert questions" on public.questions;
create policy "Allow anon insert questions"
on public.questions for insert to anon with check (true);

drop policy if exists "Allow anon update questions" on public.questions;
create policy "Allow anon update questions"
on public.questions for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete questions" on public.questions;
create policy "Allow anon delete questions"
on public.questions for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- options
-- ---------------------------------------------------------------------------
create table if not exists public.options (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references public.questions (id) on delete cascade,
    option_letter text not null,
    option_text text not null,
    explanation text,
    is_correct boolean not null default false
);

create index if not exists options_question_id_idx on public.options (question_id);

alter table public.options enable row level security;

drop policy if exists "Allow anon select options" on public.options;
create policy "Allow anon select options"
on public.options for select to anon using (true);

drop policy if exists "Allow anon insert options" on public.options;
create policy "Allow anon insert options"
on public.options for insert to anon with check (true);

drop policy if exists "Allow anon update options" on public.options;
create policy "Allow anon update options"
on public.options for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete options" on public.options;
create policy "Allow anon delete options"
on public.options for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- flashcards
-- ---------------------------------------------------------------------------
create table if not exists public.flashcards (
    id uuid primary key default gen_random_uuid(),
    front text not null,
    back text not null,
    explanation text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_flashcards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_flashcards_updated_at on public.flashcards;
create trigger trg_set_flashcards_updated_at
before update on public.flashcards
for each row execute function public.set_flashcards_updated_at();

alter table public.flashcards enable row level security;

drop policy if exists "Allow anon select flashcards" on public.flashcards;
create policy "Allow anon select flashcards"
on public.flashcards for select to anon using (true);

drop policy if exists "Allow anon insert flashcards" on public.flashcards;
create policy "Allow anon insert flashcards"
on public.flashcards for insert to anon with check (true);

drop policy if exists "Allow anon update flashcards" on public.flashcards;
create policy "Allow anon update flashcards"
on public.flashcards for update to anon using (true) with check (true);

drop policy if exists "Allow anon delete flashcards" on public.flashcards;
create policy "Allow anon delete flashcards"
on public.flashcards for delete to anon using (true);
