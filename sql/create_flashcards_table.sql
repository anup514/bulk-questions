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
on public.flashcards
for select
to anon
using (true);

drop policy if exists "Allow anon insert flashcards" on public.flashcards;
create policy "Allow anon insert flashcards"
on public.flashcards
for insert
to anon
with check (true);

drop policy if exists "Allow anon update flashcards" on public.flashcards;
create policy "Allow anon update flashcards"
on public.flashcards
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anon delete flashcards" on public.flashcards;
create policy "Allow anon delete flashcards"
on public.flashcards
for delete
to anon
using (true);
