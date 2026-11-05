-- =====================================================================
-- Task Management System — database setup
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- If the `tasks` table already exists, CREATE TABLE is skipped and the
-- rest (constraints, trigger, indexes, RLS) is applied to it.
-- =====================================================================

-- 1. Table ------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null,
  description  text,
  priority     text        not null default 'medium',
  status       text        not null default 'pending',
  assigned_to  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2. Data validation (mirrors src/utils/validation.js) -----------------
-- Server-side checks so bad data is rejected even if the UI is bypassed.
-- NOT VALID = applies to new/changed rows without failing on old rows.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_title_length') then
    alter table public.tasks add constraint tasks_title_length
      check (char_length(btrim(title)) between 3 and 150) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_description_length') then
    alter table public.tasks add constraint tasks_description_length
      check (description is null or char_length(description) <= 2000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_assigned_to_length') then
    alter table public.tasks add constraint tasks_assigned_to_length
      check (assigned_to is null or char_length(assigned_to) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table public.tasks add constraint tasks_priority_check
      check (priority in ('low', 'medium', 'high')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_status_check') then
    alter table public.tasks add constraint tasks_status_check
      check (status in ('pending', 'in_progress', 'completed')) not valid;
  end if;
end $$;

-- 3. Keep updated_at current on every UPDATE ---------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- 4. Indexes for filters / sorting -------------------------------------
create index if not exists tasks_status_idx     on public.tasks (status);
create index if not exists tasks_priority_idx   on public.tasks (priority);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
create index if not exists tasks_updated_at_idx on public.tasks (updated_at desc);

-- 5. Row Level Security ------------------------------------------------
-- Anonymous visitors get NOTHING. Signed-in users share one team board
-- and may read / create / edit / delete tasks.
alter table public.tasks enable row level security;
alter table public.tasks force row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

drop policy if exists "tasks_select_authenticated" on public.tasks;
drop policy if exists "tasks_insert_authenticated" on public.tasks;
drop policy if exists "tasks_update_authenticated" on public.tasks;
drop policy if exists "tasks_delete_authenticated" on public.tasks;

create policy "tasks_select_authenticated" on public.tasks
  for select to authenticated using (true);

create policy "tasks_insert_authenticated" on public.tasks
  for insert to authenticated with check (true);

create policy "tasks_update_authenticated" on public.tasks
  for update to authenticated using (true) with check (true);

create policy "tasks_delete_authenticated" on public.tasks
  for delete to authenticated using (true);

-- ---------------------------------------------------------------------
-- OPTIONAL: per-user ownership (each user sees only their own tasks).
-- Uncomment to restrict rows to the person who created them.
-- ---------------------------------------------------------------------
-- alter table public.tasks add column if not exists created_by uuid
--   default auth.uid() references auth.users (id) on delete set null;
-- drop policy "tasks_select_authenticated" on public.tasks;
-- drop policy "tasks_update_authenticated" on public.tasks;
-- drop policy "tasks_delete_authenticated" on public.tasks;
-- create policy "tasks_select_own" on public.tasks for select to authenticated
--   using (created_by = (select auth.uid()));
-- create policy "tasks_update_own" on public.tasks for update to authenticated
--   using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
-- create policy "tasks_delete_own" on public.tasks for delete to authenticated
--   using (created_by = (select auth.uid()));
