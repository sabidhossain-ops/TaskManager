-- =====================================================================
-- BHL Task Management — Supabase database (v2)
-- Run the whole file in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- What it creates
--   profiles          one row per Supabase Auth user (name, role, designation, active)
--   master_items      editable lists: designation, task type, center, source, department, root cause
--   sla_policies      resolution time per priority
--   tasks             the tasks (ID format BHL-TASK-YYYY-NNNNNN)
--   task_worklogs     remarks and resolution notes
--   task_assignments  assignment / transfer history
--   task_extensions   deadline extension requests and decisions
--   task_audit        full audit trail
--
-- All workflow changes go through SECURITY DEFINER functions (create_task,
-- task_action, update_task_details, admin_update_profile) that check the
-- caller's role and write history in one transaction. The browser has
-- read access only (through Row Level Security), so history cannot be
-- forged or skipped.
--
-- The first user who exists in Authentication becomes Admin automatically.
-- =====================================================================

create schema if not exists app_private;
revoke all on schema app_private from public;

-- ---------------------------------------------------------------------
-- 0. Replace the v1 `tasks` table (the simple CRUD version) — only if empty
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tasks') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'tasks' and column_name = 'task_no'
     ) then
    if exists (select 1 from public.tasks) then
      raise exception 'public.tasks (v1) still has rows. Back them up and empty the table, then run this script again.';
    end if;
    drop table public.tasks cascade;
  end if;
end $$;

-- Shared trigger: keep updated_at current
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Profiles (linked to auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 100),
  email       text,
  designation text,
  role        text not null default 'Expert'
              check (role in ('Admin', 'Supervisor', 'Expert', 'Management')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role of the signed-in user (NULL when inactive or unknown)
create or replace function public.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid()) and active
$$;

-- New auth user → profile. The very first user becomes Admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, designation, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'designation'), ''),
    case when exists (select 1 from public.profiles) then 'Expert' else 'Admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Back-fill profiles for users created before this script ran
insert into public.profiles (id, full_name, email, role)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
       u.email,
       case when row_number() over (order by u.created_at) = 1
                 and not exists (select 1 from public.profiles) then 'Admin' else 'Expert' end
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Master lists and SLA policies
-- ---------------------------------------------------------------------
create table if not exists public.master_items (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('designation', 'task_type', 'center', 'source', 'department', 'root_cause')),
  value      text not null check (char_length(btrim(value)) between 1 and 100),
  sort_order integer not null default 1000,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

do $$
declare
  seeds constant jsonb := '{
    "designation": ["IT Officer","Network Engineer","Application Support Engineer","Database Administrator","System Administrator","Assistant Manager, IT","Manager, IT","Head of IT"],
    "task_type":   ["Incident","Service Request","IT Support","Application Support","Infrastructure","Network","Hardware","Software","Security","Database","Development","Change Request","Vendor Issue","User Access","New Center Support","Procurement","Other"],
    "center":      ["BRAC Healthcare HO","Badda Centre","Noakhali Centre","Siddheswari Centre","Kazipara Centre","Other"],
    "source":      ["Email","Phone","WhatsApp","Portal","Walk-in","Monitoring"],
    "department":  ["IT","Operations","Clinical","Finance","HR","Procurement"],
    "root_cause":  ["User Error","Application Issue","Network Issue","Hardware Issue","Vendor Issue","Configuration Issue","Infrastructure Issue","Unknown","Other"]
  }';
  k text;
begin
  for k in select jsonb_object_keys(seeds) loop
    -- Seed a list only the first time, so values an admin removed do not come back.
    if not exists (select 1 from public.master_items where kind = k) then
      insert into public.master_items (kind, value, sort_order)
      select k, v.value, v.ord
      from jsonb_array_elements_text(seeds -> k) with ordinality as v(value, ord);
    end if;
  end loop;
end $$;

create table if not exists public.sla_policies (
  priority           text primary key check (priority in ('Critical', 'High', 'Medium', 'Low')),
  resolution_minutes integer not null check (resolution_minutes > 0),
  sort_order         integer not null
);
insert into public.sla_policies (priority, resolution_minutes, sort_order) values
  ('Critical', 240, 1), ('High', 480, 2), ('Medium', 2880, 3), ('Low', 7200, 4)
on conflict (priority) do nothing;

-- ---------------------------------------------------------------------
-- 3. Tasks
-- ---------------------------------------------------------------------
create table if not exists public.task_counters (
  year    integer primary key,
  last_no integer not null default 0
);

create table if not exists public.tasks (
  id                 bigint generated always as identity primary key,
  task_no            text unique,
  title              text not null check (char_length(btrim(title)) between 3 and 200),
  description        text check (description is null or char_length(description) <= 5000),
  task_type          text not null,
  priority           text not null references public.sla_policies (priority),
  center             text not null,
  department         text not null,
  source             text not null,
  raised_by          text not null check (char_length(btrim(raised_by)) between 1 and 100),
  contact            text not null check (contact ~ '^[0-9+ ()-]{6,20}$'),
  assigned_to        uuid references public.profiles (id) on delete set null,
  status             text not null default 'New'
                     check (status in ('New', 'Assigned', 'Acknowledged', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled')),
  deadline           timestamptz not null,
  original_deadline  timestamptz not null,
  extension_count    integer not null default 0,
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  resolution_summary text,
  root_cause         text,
  action_taken       text,
  preventive_action  text,
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists tasks_status_idx      on public.tasks (status);
create index if not exists tasks_priority_idx    on public.tasks (priority);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_created_by_idx  on public.tasks (created_by);
create index if not exists tasks_created_at_idx  on public.tasks (created_at desc);
create index if not exists tasks_deadline_idx    on public.tasks (deadline);

-- Task number: BHL-TASK-<year>-<6-digit sequence per year>
create or replace function public.assign_task_no()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  y integer := extract(year from (now() at time zone 'Asia/Dhaka'))::integer;
  n integer;
begin
  insert into public.task_counters (year, last_no) values (y, 1)
  on conflict (year) do update set last_no = public.task_counters.last_no + 1
  returning last_no into n;
  new.task_no := format('BHL-TASK-%s-%s', y, lpad(n::text, 6, '0'));
  return new;
end $$;

drop trigger if exists tasks_assign_task_no on public.tasks;
create trigger tasks_assign_task_no before insert on public.tasks
  for each row execute function public.assign_task_no();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- History tables -------------------------------------------------------
create table if not exists public.task_worklogs (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references public.tasks (id) on delete cascade,
  kind       text not null default 'Remark' check (kind in ('Remark', 'Resolution')),
  status     text not null,
  body       text not null check (char_length(btrim(body)) between 1 and 5000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id          bigint generated always as identity primary key,
  task_id     bigint not null references public.tasks (id) on delete cascade,
  from_user   uuid references public.profiles (id) on delete set null,
  to_user     uuid references public.profiles (id) on delete set null,
  assigned_by uuid references public.profiles (id) on delete set null,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.task_extensions (
  id                 bigint generated always as identity primary key,
  task_id            bigint not null references public.tasks (id) on delete cascade,
  requested_by       uuid references public.profiles (id) on delete set null,
  current_deadline   timestamptz not null,
  requested_deadline timestamptz not null,
  reason             text not null,
  state              text not null default 'Pending' check (state in ('Pending', 'Approved', 'Rejected')),
  decided_by         uuid references public.profiles (id) on delete set null,
  decided_at         timestamptz,
  created_at         timestamptz not null default now()
);
create unique index if not exists task_extensions_one_pending
  on public.task_extensions (task_id) where state = 'Pending';

create table if not exists public.task_audit (
  id         bigint generated always as identity primary key,
  task_id    bigint not null references public.tasks (id) on delete cascade,
  actor      uuid references public.profiles (id) on delete set null,
  action     text not null,
  old_value  text not null default '',
  new_value  text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists task_worklogs_task_idx    on public.task_worklogs (task_id, created_at);
create index if not exists task_assignments_task_idx on public.task_assignments (task_id, created_at);
create index if not exists task_extensions_task_idx  on public.task_extensions (task_id, created_at);
create index if not exists task_audit_task_idx       on public.task_audit (task_id, created_at);
create index if not exists task_audit_created_idx    on public.task_audit (created_at desc);

-- ---------------------------------------------------------------------
-- 4. Private helpers (not exposed through the API)
-- ---------------------------------------------------------------------
create or replace function app_private.fmt_ts(ts timestamptz)
returns text language sql stable set search_path = '' as $$
  select coalesce(to_char(ts at time zone 'Asia/Dhaka', 'DD Mon YYYY HH24:MI'), '—')
$$;

create or replace function app_private.user_name(uid uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce((select full_name from public.profiles where id = uid), 'Unassigned')
$$;

create or replace function app_private.audit(p_task bigint, p_action text, p_old text default '', p_new text default '')
returns void language sql set search_path = '' as $$
  insert into public.task_audit (task_id, actor, action, old_value, new_value)
  values (p_task, auth.uid(), p_action, coalesce(p_old, ''), coalesce(p_new, ''));
$$;

create or replace function app_private.worklog(p_task bigint, p_status text, p_body text, p_kind text default 'Remark')
returns void language plpgsql set search_path = '' as $$
begin
  insert into public.task_worklogs (task_id, kind, status, body, created_by)
  values (p_task, p_kind, p_status, p_body, auth.uid());
  perform app_private.audit(p_task, case when p_kind = 'Remark' then 'Remark added' else p_kind end, '', left(p_body, 60));
end $$;

revoke all on all functions in schema app_private from public;

-- ---------------------------------------------------------------------
-- 5. Workflow API (called from the app with supabase.rpc)
-- ---------------------------------------------------------------------

-- Create a task (Admin / Supervisor)
create or replace function public.create_task(p jsonb)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  v_role     text := public.app_role();
  v_to       uuid := nullif(p ->> 'assigned_to', '')::uuid;
  v_deadline timestamptz := nullif(p ->> 'deadline', '')::timestamptz;
  v_task     public.tasks;
begin
  if v_role is null or v_role not in ('Admin', 'Supervisor') then
    raise exception 'Only administrators and supervisors can create tasks.';
  end if;
  if char_length(coalesce(btrim(p ->> 'title'), '')) < 3 then
    raise exception 'Task title must be at least 3 characters.';
  end if;
  if coalesce(p ->> 'task_type', '') = '' or coalesce(p ->> 'center', '') = ''
     or coalesce(p ->> 'department', '') = '' or coalesce(p ->> 'source', '') = '' then
    raise exception 'Fill in task type, center, department and source.';
  end if;
  if not exists (select 1 from public.sla_policies where priority = p ->> 'priority') then
    raise exception 'Choose a valid priority.';
  end if;
  if coalesce(btrim(p ->> 'contact'), '') !~ '^[0-9+ ()-]{6,20}$' then
    raise exception 'Enter a valid contact number for the person who raised the task.';
  end if;
  if v_deadline is null or v_deadline <= now() then
    raise exception 'Deadline must be in the future.';
  end if;
  if v_to is not null and not exists (select 1 from public.profiles where id = v_to and role = 'Expert' and active) then
    raise exception 'Choose an active expert to assign.';
  end if;

  insert into public.tasks (title, description, task_type, priority, center, department, source,
                            raised_by, contact, assigned_to, status, deadline, original_deadline, created_by)
  values (btrim(p ->> 'title'), nullif(btrim(p ->> 'description'), ''), p ->> 'task_type', p ->> 'priority',
          p ->> 'center', p ->> 'department', p ->> 'source',
          coalesce(nullif(btrim(p ->> 'raised_by'), ''), app_private.user_name(auth.uid())),
          btrim(p ->> 'contact'), v_to,
          case when v_to is null then 'New' else 'Assigned' end,
          v_deadline, v_deadline, auth.uid())
  returning * into v_task;

  perform app_private.audit(v_task.id, 'Task created', '', v_task.priority);
  if v_to is not null then
    insert into public.task_assignments (task_id, from_user, to_user, assigned_by, reason)
    values (v_task.id, null, v_to, auth.uid(), 'Initial assignment');
    perform app_private.audit(v_task.id, 'Assigned', '', app_private.user_name(v_to));
  end if;
  return v_task;
end $$;

-- Edit the descriptive fields of an open task (Admin / Supervisor)
create or replace function public.update_task_details(p_task_id bigint, p jsonb)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  v_role text := public.app_role();
  t      public.tasks;
  n      public.tasks;
  f      text;
begin
  if v_role is null or v_role not in ('Admin', 'Supervisor') then
    raise exception 'Only administrators and supervisors can edit task details.';
  end if;
  select * into t from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found.'; end if;
  if t.status in ('Closed', 'Cancelled') then
    raise exception 'Closed or cancelled tasks cannot be edited.';
  end if;
  if char_length(coalesce(btrim(p ->> 'title'), '')) < 3 then
    raise exception 'Task title must be at least 3 characters.';
  end if;
  if coalesce(btrim(p ->> 'contact'), '') !~ '^[0-9+ ()-]{6,20}$' then
    raise exception 'Enter a valid contact number for the person who raised the task.';
  end if;
  if not exists (select 1 from public.sla_policies where priority = p ->> 'priority') then
    raise exception 'Choose a valid priority.';
  end if;

  update public.tasks set
    title       = btrim(p ->> 'title'),
    description = nullif(btrim(p ->> 'description'), ''),
    task_type   = coalesce(nullif(p ->> 'task_type', ''), task_type),
    priority    = p ->> 'priority',
    center      = coalesce(nullif(p ->> 'center', ''), center),
    department  = coalesce(nullif(p ->> 'department', ''), department),
    source      = coalesce(nullif(p ->> 'source', ''), source),
    raised_by   = coalesce(nullif(btrim(p ->> 'raised_by'), ''), raised_by),
    contact     = btrim(p ->> 'contact')
  where id = t.id
  returning * into n;

  foreach f in array array['title', 'description', 'task_type', 'priority', 'center', 'department', 'source', 'raised_by', 'contact'] loop
    if (to_jsonb(t) ->> f) is distinct from (to_jsonb(n) ->> f) then
      perform app_private.audit(t.id, 'Edited ' || replace(f, '_', ' '),
                                left(coalesce(to_jsonb(t) ->> f, ''), 60), left(coalesce(to_jsonb(n) ->> f, ''), 60));
    end if;
  end loop;
  return n;
end $$;

-- All workflow actions. p_action is one of:
--   assign, forward, acknowledge, start, hold, remark, resolve, close, cancel,
--   request_extension, approve_extension, reject_extension
create or replace function public.task_action(p_task_id bigint, p_action text, p jsonb default '{}'::jsonb)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  v_role       text := public.app_role();
  v_me         uuid := auth.uid();
  t            public.tasks;
  v_sup        boolean;
  v_mine       boolean;
  v_open       boolean;
  v_text       text := nullif(btrim(coalesce(p ->> 'text', '')), '');
  v_reason     text := nullif(btrim(coalesce(p ->> 'reason', '')), '');
  v_to         uuid;
  v_when       timestamptz;
  v_ext        public.task_extensions;
  v_new_status text;
begin
  if v_role is null then
    raise exception 'Your account is inactive or not set up.';
  end if;

  select * into t from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found.'; end if;

  v_sup  := v_role in ('Admin', 'Supervisor');
  v_mine := coalesce(t.assigned_to = v_me, false);
  v_open := t.status in ('New', 'Assigned', 'Acknowledged', 'In Progress', 'On Hold');

  case p_action
  when 'assign', 'forward' then
    if not v_open then raise exception 'This task is no longer open.'; end if;
    if p_action = 'assign' and not v_sup then raise exception 'Only supervisors can assign tasks.'; end if;
    if p_action = 'forward' and not v_mine then raise exception 'Only the assigned expert can forward this task.'; end if;
    v_to := nullif(p ->> 'to', '')::uuid;
    if v_to is null then raise exception 'Select an expert.'; end if;
    if v_to = t.assigned_to then raise exception 'The task is already assigned to this expert.'; end if;
    if not exists (select 1 from public.profiles where id = v_to and role = 'Expert' and active) then
      raise exception 'Choose an active expert.';
    end if;
    if t.assigned_to is not null and v_reason is null then
      raise exception 'Enter the reason for the transfer.';
    end if;
    perform app_private.audit(t.id,
      case when t.assigned_to is null then 'Assigned' else 'Reassigned' end,
      case when t.assigned_to is null then '' else app_private.user_name(t.assigned_to) end,
      app_private.user_name(v_to));
    insert into public.task_assignments (task_id, from_user, to_user, assigned_by, reason)
    values (t.id, t.assigned_to, v_to, v_me, coalesce(v_reason, ''));
    t.assigned_to := v_to;
    v_new_status := 'Assigned';

  when 'acknowledge' then
    if not (v_mine and t.status = 'Assigned') then
      raise exception 'You can only acknowledge tasks assigned to you.';
    end if;
    t.first_response_at := coalesce(t.first_response_at, now());
    v_new_status := 'Acknowledged';

  when 'start' then
    if not (v_mine and t.status in ('Assigned', 'Acknowledged', 'On Hold')) then
      raise exception 'You cannot start work on this task.';
    end if;
    t.first_response_at := coalesce(t.first_response_at, now());
    v_new_status := 'In Progress';

  when 'hold' then
    if not (v_mine and t.status = 'In Progress') then raise exception 'You cannot put this task on hold.'; end if;
    if v_text is null then raise exception 'Enter the reason for holding.'; end if;
    v_new_status := 'On Hold';

  when 'remark' then
    if not (v_open and (v_sup or v_mine)) then raise exception 'You cannot add a remark to this task.'; end if;
    if v_text is null then raise exception 'Write a remark.'; end if;
    t.first_response_at := coalesce(t.first_response_at, now());

  when 'resolve' then
    if not (v_mine and t.status = 'In Progress') then raise exception 'You can only resolve tasks you are working on.'; end if;
    if nullif(btrim(coalesce(p ->> 'summary', '')), '') is null or nullif(btrim(coalesce(p ->> 'action_taken', '')), '') is null then
      raise exception 'Resolution summary and action taken are required.';
    end if;
    t.resolution_summary := btrim(p ->> 'summary');
    t.root_cause         := coalesce(nullif(btrim(p ->> 'root_cause'), ''), 'Unknown');
    t.action_taken       := btrim(p ->> 'action_taken');
    t.preventive_action  := nullif(btrim(coalesce(p ->> 'preventive_action', '')), '');
    t.resolved_at        := now();
    v_new_status := 'Resolved';

  when 'close' then
    if not (v_sup and t.status = 'Resolved') then raise exception 'Only supervisors can close resolved tasks.'; end if;
    t.closed_at := now();
    v_new_status := 'Closed';

  when 'cancel' then
    if not (v_sup and v_open) then raise exception 'Only supervisors can cancel open tasks.'; end if;
    if v_text is null then raise exception 'Enter a cancellation reason.'; end if;
    t.closed_at := now();
    v_new_status := 'Cancelled';

  when 'request_extension' then
    if not (v_mine and v_open) then raise exception 'Only the assigned expert can request an extension.'; end if;
    if exists (select 1 from public.task_extensions where task_id = t.id and state = 'Pending') then
      raise exception 'An extension request is already pending.';
    end if;
    v_when := nullif(p ->> 'requested_deadline', '')::timestamptz;
    if v_when is null or v_when <= t.deadline then
      raise exception 'Requested deadline must be later than the current deadline.';
    end if;
    if v_text is null then raise exception 'Enter a reason.'; end if;
    insert into public.task_extensions (task_id, requested_by, current_deadline, requested_deadline, reason)
    values (t.id, v_me, t.deadline, v_when, v_text);
    perform app_private.audit(t.id, 'Extension requested', app_private.fmt_ts(t.deadline), app_private.fmt_ts(v_when));

  when 'approve_extension', 'reject_extension' then
    if not v_sup then raise exception 'Only supervisors can decide on extension requests.'; end if;
    select * into v_ext from public.task_extensions where task_id = t.id and state = 'Pending' for update;
    if not found then raise exception 'There is no pending extension request.'; end if;
    update public.task_extensions
       set state = case when p_action = 'approve_extension' then 'Approved' else 'Rejected' end,
           decided_by = v_me, decided_at = now()
     where id = v_ext.id;
    if p_action = 'approve_extension' then
      t.deadline := v_ext.requested_deadline;
      t.extension_count := t.extension_count + 1;
    end if;
    perform app_private.audit(t.id,
      case when p_action = 'approve_extension' then 'Extension approved' else 'Extension rejected' end,
      app_private.fmt_ts(v_ext.current_deadline), app_private.fmt_ts(v_ext.requested_deadline));

  else
    raise exception 'Unknown action: %', p_action;
  end case;

  if v_new_status is not null and v_new_status <> t.status then
    perform app_private.audit(t.id, 'Status change', t.status, v_new_status);
    t.status := v_new_status;
  end if;

  -- Worklog entries record the status after the change (as in the original app)
  if p_action in ('hold', 'remark', 'cancel') or (p_action = 'close' and v_text is not null) then
    perform app_private.worklog(t.id, t.status, v_text);
  elsif p_action = 'resolve' then
    perform app_private.worklog(t.id, t.status, 'Resolved: ' || t.resolution_summary, 'Resolution');
  end if;

  update public.tasks set
    assigned_to        = t.assigned_to,
    status             = t.status,
    deadline           = t.deadline,
    extension_count    = t.extension_count,
    first_response_at  = t.first_response_at,
    resolved_at        = t.resolved_at,
    closed_at          = t.closed_at,
    resolution_summary = t.resolution_summary,
    root_cause         = t.root_cause,
    action_taken       = t.action_taken,
    preventive_action  = t.preventive_action
  where id = t.id
  returning * into t;
  return t;
end $$;

-- Change another user's name / role / designation / active flag (Admin)
create or replace function public.admin_update_profile(p_id uuid, p jsonb)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare
  v_new public.profiles;
begin
  if public.app_role() is distinct from 'Admin' then
    raise exception 'Only administrators can manage users.';
  end if;
  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'User not found.';
  end if;
  if p_id = auth.uid() and (coalesce((p ->> 'active')::boolean, true) = false or coalesce(p ->> 'role', 'Admin') <> 'Admin') then
    raise exception 'You cannot deactivate your own account or remove your own administrator role.';
  end if;
  if p ? 'role' and p ->> 'role' not in ('Admin', 'Supervisor', 'Expert', 'Management') then
    raise exception 'Choose a valid role.';
  end if;

  update public.profiles set
    full_name   = coalesce(nullif(btrim(p ->> 'full_name'), ''), full_name),
    role        = coalesce(nullif(p ->> 'role', ''), role),
    designation = case when p ? 'designation' then nullif(btrim(p ->> 'designation'), '') else designation end,
    active      = coalesce((p ->> 'active')::boolean, active)
  where id = p_id
  returning * into v_new;
  return v_new;
end $$;

-- Dashboard numbers. SECURITY INVOKER, so Row Level Security scopes the
-- result: experts get figures for their own tasks only.
create or replace function public.dashboard_stats()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with t as (
    select t.status, t.priority, t.assigned_to, t.deadline, t.created_at, t.resolved_at,
           t.status in ('New', 'Assigned', 'Acknowledged', 'In Progress', 'On Hold') as is_open,
           t.created_at + make_interval(mins => s.resolution_minutes) as due
    from public.tasks t
    join public.sla_policies s on s.priority = t.priority
  ), open_age as (
    select extract(epoch from now() - created_at) / 86400 as days from t where is_open
  )
  select jsonb_build_object(
    'total',         (select count(*) from t),
    'by_status',     coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from t group by status) x), '{}'::jsonb),
    'by_priority',   coalesce((select jsonb_object_agg(priority, n) from (select priority, count(*) n from t group by priority) x), '{}'::jsonb),
    'critical_open', (select count(*) from t where priority = 'Critical' and is_open),
    'overdue',       (select count(*) from t where is_open and deadline < now()),
    'sla_breached',  (select count(*) from t where status <> 'Cancelled'
                        and case when resolved_at is not null then resolved_at > due else now() > due end),
    'due_today',     (select count(*) from t where is_open
                        and (deadline at time zone 'Asia/Dhaka')::date = (now() at time zone 'Asia/Dhaka')::date),
    'avg_resolution_minutes', (select round(avg(extract(epoch from resolved_at - created_at) / 60)) from t where resolved_at is not null),
    'aging', jsonb_build_object(
       '0–1 days',  (select count(*) from open_age where days < 2),
       '2–3 days',  (select count(*) from open_age where days >= 2 and days < 4),
       '4–7 days',  (select count(*) from open_age where days >= 4 and days < 8),
       '8–15 days', (select count(*) from open_age where days >= 8 and days < 16),
       '15+ days',  (select count(*) from open_age where days >= 16)),
    'open_by_expert', coalesce((
       select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name,
                        'open', (select count(*) from t where t.assigned_to = p.id and t.is_open)) order by p.full_name)
       from public.profiles p where p.role = 'Expert' and p.active), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security and privileges
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.master_items     enable row level security;
alter table public.sla_policies     enable row level security;
alter table public.task_counters    enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_worklogs    enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_extensions  enable row level security;
alter table public.task_audit       enable row level security;

-- The browser never writes these tables directly — only through the functions above.
revoke all on public.profiles, public.master_items, public.sla_policies, public.task_counters, public.tasks,
              public.task_worklogs, public.task_assignments, public.task_extensions, public.task_audit
  from anon, authenticated;

grant select on public.profiles, public.master_items, public.sla_policies, public.tasks,
                public.task_worklogs, public.task_assignments, public.task_extensions, public.task_audit
  to authenticated;
grant insert, delete on public.master_items to authenticated;
grant delete on public.tasks to authenticated;

-- profiles: any active user can see the directory; everyone can see their own row
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ((select public.app_role()) is not null or id = (select auth.uid()));

-- master lists: everyone reads, Admin edits
drop policy if exists master_items_select on public.master_items;
drop policy if exists master_items_insert on public.master_items;
drop policy if exists master_items_delete on public.master_items;
create policy master_items_select on public.master_items for select to authenticated
  using ((select public.app_role()) is not null);
create policy master_items_insert on public.master_items for insert to authenticated
  with check ((select public.app_role()) = 'Admin');
create policy master_items_delete on public.master_items for delete to authenticated
  using ((select public.app_role()) = 'Admin');

drop policy if exists sla_policies_select on public.sla_policies;
create policy sla_policies_select on public.sla_policies for select to authenticated
  using ((select public.app_role()) is not null);

-- tasks: Admin / Supervisor / Management see all; Experts see tasks assigned to or created by them
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (
    (select public.app_role()) in ('Admin', 'Supervisor', 'Management')
    or ((select public.app_role()) = 'Expert'
        and (assigned_to = (select auth.uid()) or created_by = (select auth.uid())))
  );
create policy tasks_delete on public.tasks for delete to authenticated
  using ((select public.app_role()) = 'Admin');

-- history tables: visible when the parent task is visible
drop policy if exists task_worklogs_select on public.task_worklogs;
drop policy if exists task_assignments_select on public.task_assignments;
drop policy if exists task_extensions_select on public.task_extensions;
drop policy if exists task_audit_select on public.task_audit;
create policy task_worklogs_select on public.task_worklogs for select to authenticated
  using (exists (select 1 from public.tasks x where x.id = task_id));
create policy task_assignments_select on public.task_assignments for select to authenticated
  using (exists (select 1 from public.tasks x where x.id = task_id));
create policy task_extensions_select on public.task_extensions for select to authenticated
  using (exists (select 1 from public.tasks x where x.id = task_id));
create policy task_audit_select on public.task_audit for select to authenticated
  using (exists (select 1 from public.tasks x where x.id = task_id));

-- Functions: only signed-in users may call the API
revoke execute on function public.app_role(), public.create_task(jsonb), public.update_task_details(bigint, jsonb),
  public.task_action(bigint, text, jsonb), public.admin_update_profile(uuid, jsonb), public.dashboard_stats()
  from public, anon;
grant execute on function public.app_role(), public.create_task(jsonb), public.update_task_details(bigint, jsonb),
  public.task_action(bigint, text, jsonb), public.admin_update_profile(uuid, jsonb), public.dashboard_stats()
  to authenticated;
revoke execute on function public.handle_new_user(), public.assign_task_no(), public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Realtime: push task changes to open browsers
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;
