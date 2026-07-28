-- Delete all questions with index > 938 (and cascaded options).
-- Keeps index 938 and below.
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run

begin;

-- Preview counts before deleting (optional; comment out if you prefer)
-- select count(*) as to_delete from public.questions where "index" > 938;
-- select min("index") as min_index, max("index") as max_index
-- from public.questions where "index" > 938;

delete from public.questions
where "index" > 938;

commit;
