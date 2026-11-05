import { supabase } from '../lib/supabaseClient';
import { STATUS_VALUES } from '../constants/task';
import { sanitiseTask, validateTask } from '../utils/validation';
import { unwrap } from './errors';

const TABLE = 'tasks';
const COLUMNS = 'id, title, description, priority, status, assigned_to, created_at, updated_at';

/** Escape characters that have meaning inside PostgREST filters / LIKE. */
function escapeSearch(term) {
  return term
    .replace(/[\\%_]/g, (c) => `\\${c}`) // LIKE wildcards
    .replace(/[,()"]/g, ' ') // PostgREST .or() separators
    .trim();
}

function assertValid(task) {
  const errors = validateTask(task);
  if (Object.keys(errors).length) {
    const e = new Error(Object.values(errors)[0]);
    e.fieldErrors = errors;
    throw e;
  }
  return sanitiseTask(task);
}

/**
 * Paginated, filtered task list (server-side).
 * @returns {{ rows: object[], total: number }}
 */
export async function listTasks({
  page = 1,
  pageSize = 10,
  search = '',
  status = '',
  priority = '',
  sortBy = 'created_at',
  ascending = false,
} = {}) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from(TABLE).select(COLUMNS, { count: 'exact' });

  const term = escapeSearch(search);
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,assigned_to.ilike.%${term}%`,
    );
  }
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);

  const { data, count } = unwrap(
    await query.order(sortBy, { ascending }).order('id', { ascending }).range(from, to),
    'Unable to load tasks.',
  );
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getTask(id) {
  const { data } = unwrap(
    await supabase.from(TABLE).select(COLUMNS).eq('id', id).single(),
    'Unable to load the task.',
  );
  return data;
}

export async function createTask(input) {
  const payload = assertValid(input);
  const { data } = unwrap(
    await supabase.from(TABLE).insert(payload).select(COLUMNS).single(),
    'Unable to create the task.',
  );
  return data;
}

export async function updateTask(id, input) {
  const payload = assertValid(input);
  const { data } = unwrap(
    await supabase
      .from(TABLE)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(COLUMNS)
      .single(),
    'Unable to update the task.',
  );
  return data;
}

export async function deleteTask(id) {
  const { data } = unwrap(
    await supabase.from(TABLE).delete().eq('id', id).select('id'),
    'Unable to delete the task.',
  );
  if (!data?.length) throw new Error('Task not found, or you do not have permission to delete it.');
}

/** Counts for the dashboard cards: total + one per status. */
export async function getTaskStats() {
  const countWhere = (status) => {
    let q = supabase.from(TABLE).select('id', { count: 'exact', head: true });
    if (status) q = q.eq('status', status);
    return q;
  };

  const results = await Promise.all([countWhere(null), ...STATUS_VALUES.map(countWhere)]);
  const counts = results.map((r) => unwrap(r, 'Unable to load statistics.').count ?? 0);

  const stats = { total: counts[0] };
  STATUS_VALUES.forEach((s, i) => (stats[s] = counts[i + 1]));
  return stats;
}

export async function getRecentTasks(limit = 5) {
  const { data } = unwrap(
    await supabase.from(TABLE).select(COLUMNS).order('updated_at', { ascending: false }).limit(limit),
    'Unable to load recent tasks.',
  );
  return data ?? [];
}
