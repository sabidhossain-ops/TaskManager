import { supabase } from '../lib/supabaseClient';
import { AUDIT_LIMIT, EXPORT_LIMIT, OPEN_STATUSES } from '../constants/task';
import { unwrap } from './errors';

const ASSIGNEE = 'assignee:profiles!tasks_assigned_to_fkey(id, full_name, designation)';
const LIST_COLUMNS = `id, task_no, title, task_type, priority, status, center, department, source, raised_by,
  deadline, created_at, resolved_at, closed_at, assigned_to, ${ASSIGNEE}`;

/** Escape characters that have meaning inside PostgREST filters / LIKE. */
function escapeSearch(term) {
  return term
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/[,()"]/g, ' ')
    .trim();
}

function applyFilters(query, { search = '', status = '', priority = '', overdueOnly = false, assignedTo = null } = {}) {
  const term = escapeSearch(search);
  if (term) query = query.or(`task_no.ilike.%${term}%,title.ilike.%${term}%`);
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (overdueOnly) query = query.in('status', OPEN_STATUSES).lt('deadline', new Date().toISOString());
  if (assignedTo) query = query.eq('assigned_to', assignedTo);
  return query;
}

/** Paginated task list. Row Level Security limits what each role can see. */
export async function listTasks({ page = 1, pageSize = 25, ...filters } = {}) {
  const from = (page - 1) * pageSize;
  const query = applyFilters(supabase.from('tasks').select(LIST_COLUMNS, { count: 'exact' }), filters);
  const { data, count } = unwrap(
    await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + pageSize - 1),
    'Unable to load tasks.',
  );
  return { rows: data ?? [], total: count ?? 0 };
}

/** All rows matching the filters (for CSV export), capped at EXPORT_LIMIT. */
export async function exportTasks(filters) {
  const query = applyFilters(supabase.from('tasks').select(LIST_COLUMNS), filters);
  const { data } = unwrap(
    await query.order('created_at', { ascending: false }).limit(EXPORT_LIMIT),
    'Unable to export tasks.',
  );
  return data ?? [];
}

/** One task with its full history. Returns null when not found / not visible. */
export async function getTask(id) {
  const byTask = (table, cols) => supabase.from(table).select(cols).eq('task_id', id).order('created_at').order('id');
  const [task, worklogs, assignments, extensions, audit] = await Promise.all([
    supabase.from('tasks').select(`*, ${ASSIGNEE}`).eq('id', id).maybeSingle(),
    byTask('task_worklogs', 'id, kind, status, body, created_by, created_at'),
    byTask('task_assignments', 'id, from_user, to_user, assigned_by, reason, created_at'),
    byTask('task_extensions', 'id, requested_by, current_deadline, requested_deadline, reason, state, decided_by, decided_at, created_at'),
    byTask('task_audit', 'id, actor, action, old_value, new_value, created_at'),
  ]);
  const t = unwrap(task, 'Unable to load the task.').data;
  if (!t) return null;
  return {
    ...t,
    worklogs: unwrap(worklogs).data ?? [],
    assignments: unwrap(assignments).data ?? [],
    extensions: unwrap(extensions).data ?? [],
    audit: unwrap(audit).data ?? [],
  };
}

const taskPayload = (v) => ({
  title: v.title?.trim(),
  description: v.description?.trim() || null,
  task_type: v.task_type,
  priority: v.priority,
  center: v.center,
  department: v.department,
  source: v.source,
  raised_by: v.raised_by?.trim(),
  contact: v.contact?.trim(),
});

export async function createTask(v) {
  const { data } = unwrap(
    await supabase.rpc('create_task', {
      p: { ...taskPayload(v), assigned_to: v.assigned_to || null, deadline: v.deadline },
    }),
    'Unable to create the task.',
  );
  return data;
}

export async function updateTaskDetails(id, v) {
  const { data } = unwrap(
    await supabase.rpc('update_task_details', { p_task_id: id, p: taskPayload(v) }),
    'Unable to update the task.',
  );
  return data;
}

/** Workflow action — see public.task_action in supabase/schema.sql. */
export async function runTaskAction(id, action, payload = {}) {
  const { data } = unwrap(
    await supabase.rpc('task_action', { p_task_id: id, p_action: action, p: payload }),
    'Unable to update the task.',
  );
  return data;
}

export async function deleteTask(id) {
  const { data } = unwrap(await supabase.from('tasks').delete().eq('id', id).select('id'), 'Unable to delete the task.');
  if (!data?.length) throw new Error('Task not found, or you do not have permission to delete it.');
}

export async function getDashboardStats() {
  const { data } = unwrap(await supabase.rpc('dashboard_stats'), 'Unable to load the dashboard.');
  return data;
}

export async function listAudit(limit = AUDIT_LIMIT) {
  const { data } = unwrap(
    await supabase
      .from('task_audit')
      .select('id, action, old_value, new_value, actor, created_at, task:tasks(id, task_no)')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit),
    'Unable to load the audit log.',
  );
  return data ?? [];
}

/** Calls `onChange` whenever any visible task changes (Supabase Realtime). */
export function subscribeToTaskChanges(onChange) {
  const channel = supabase
    .channel(`tasks-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
