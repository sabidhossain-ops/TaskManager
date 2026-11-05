/**
 * Allowed values for tasks.status and tasks.priority.
 * `value` is what is stored in Postgres; `label` is what users see.
 * If your existing table stores different values, change them here
 * (and in supabase/schema.sql) — the rest of the app follows.
 */
export const TASK_STATUSES = [
  { value: 'pending', label: 'Pending', tone: 'amber' },
  { value: 'in_progress', label: 'In Progress', tone: 'blue' },
  { value: 'completed', label: 'Completed', tone: 'green' },
];

export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low', tone: 'slate' },
  { value: 'medium', label: 'Medium', tone: 'orange' },
  { value: 'high', label: 'High', tone: 'red' },
];

export const STATUS_VALUES = TASK_STATUSES.map((s) => s.value);
export const PRIORITY_VALUES = TASK_PRIORITIES.map((p) => p.value);

export const findStatus = (value) => TASK_STATUSES.find((s) => s.value === value);
export const findPriority = (value) => TASK_PRIORITIES.find((p) => p.value === value);

export const FIELD_LIMITS = {
  title: { min: 3, max: 150 },
  description: { max: 2000 },
  assigned_to: { max: 100 },
};

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 10;

export const EMPTY_TASK = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  assigned_to: '',
};
