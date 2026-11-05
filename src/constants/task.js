/** Values must match the CHECK constraints in supabase/schema.sql. */
export const STATUSES = ['New', 'Assigned', 'Acknowledged', 'In Progress', 'On Hold', 'Resolved', 'Closed', 'Cancelled'];
export const OPEN_STATUSES = ['New', 'Assigned', 'Acknowledged', 'In Progress', 'On Hold'];
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

/** Fallback SLA (resolution minutes); the live values come from the sla_policies table. */
export const DEFAULT_SLA_MINUTES = { Critical: 240, High: 480, Medium: 2880, Low: 7200 };

export const ROLES = ['Expert', 'Supervisor', 'Management', 'Admin'];
export const STAFF_ROLES = ['Admin', 'Supervisor'];

export const STATUS_TONE = {
  New: 'slate',
  Assigned: 'blue',
  Acknowledged: 'blue',
  'In Progress': 'teal',
  'On Hold': 'amber',
  Resolved: 'green',
  Closed: 'green',
  Cancelled: 'slate',
};

export const PRIORITY_TONE = { Critical: 'red', High: 'orange', Medium: 'amber', Low: 'slate' };

export const MASTER_KINDS = [
  { kind: 'designation', label: 'Designations' },
  { kind: 'task_type', label: 'Task types' },
  { kind: 'center', label: 'Centers' },
  { kind: 'source', label: 'Sources' },
  { kind: 'department', label: 'Departments' },
  { kind: 'root_cause', label: 'Root causes' },
];

export const FIELD_LIMITS = {
  title: { min: 3, max: 200 },
  description: { max: 5000 },
  raised_by: { max: 100 },
  text: { max: 5000 },
  full_name: { max: 100 },
  master: { max: 100 },
};

/** Same pattern as the database CHECK constraint. */
export const CONTACT_RE = /^[0-9+ ()-]{6,20}$/;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];
export const DEFAULT_PAGE_SIZE = 25;
export const AUDIT_LIMIT = 200;
export const EXPORT_LIMIT = 5000;
