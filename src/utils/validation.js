import { CONTACT_RE, FIELD_LIMITS, PRIORITIES, ROLES } from '../constants/task';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const trim = (v) => (typeof v === 'string' ? v.trim() : '');

/** Create / edit task form. Mirrors the checks in create_task / update_task_details. */
export function validateTaskForm(v, { isCreate }) {
  const errors = {};
  const title = trim(v.title);
  if (title.length < FIELD_LIMITS.title.min) errors.title = 'Task title must be at least 3 characters.';
  else if (title.length > FIELD_LIMITS.title.max) errors.title = `Task title must be ${FIELD_LIMITS.title.max} characters or fewer.`;
  if (trim(v.description).length > FIELD_LIMITS.description.max)
    errors.description = `Details must be ${FIELD_LIMITS.description.max} characters or fewer.`;
  for (const [k, label] of [['task_type', 'task type'], ['center', 'center'], ['department', 'department'], ['source', 'source']])
    if (!v[k]) errors[k] = `Choose a ${label}.`;
  if (!PRIORITIES.includes(v.priority)) errors.priority = 'Choose a priority.';
  if (!trim(v.raised_by)) errors.raised_by = 'Enter who raised the task.';
  if (trim(v.contact) && !CONTACT_RE.test(trim(v.contact))) errors.contact = 'Enter a valid contact number (digits, +, -, spaces), or leave it empty.';
  if (isCreate) {
    const dl = v.deadline ? new Date(v.deadline).getTime() : NaN;
    if (!dl || dl <= Date.now()) errors.deadline = 'Deadline must be in the future.';
  }
  return errors;
}

/** Workflow action forms. Returns the first error message, or ''. */
export function validateAction(action, v, task) {
  const has = (k) => trim(v[k]).length > 0;
  switch (action) {
    case 'assign':
    case 'forward':
      if (!v.to) return 'Select a user.';
      if (task.assigned_to && !has('reason')) return 'Enter the reason for the transfer.';
      return '';
    case 'hold':
      return has('text') ? '' : 'Enter the reason for holding.';
    case 'remark':
      return has('text') ? '' : 'Write a remark.';
    case 'cancel':
      return has('text') ? '' : 'Enter a cancellation reason.';
    case 'resolve':
      return has('summary') && has('action_taken') ? '' : 'Resolution summary and action taken are required.';
    case 'request_extension': {
      const d = v.requested_deadline ? new Date(v.requested_deadline).getTime() : NaN;
      if (!d || d <= new Date(task.deadline).getTime()) return 'Requested deadline must be later than the current deadline.';
      return has('text') ? '' : 'Enter a reason.';
    }
    default:
      return '';
  }
}

export const PIN_RE = /^[A-Za-z0-9-]{1,20}$/;

/** Username: any text 3–50 characters, but not an email address. */
export function usernameError(u) {
  const t = trim(u);
  if (t.length < 3 || t.length > 50) return 'Username must be 3–50 characters.';
  if (t.includes('@')) return 'Username cannot contain "@" — it is not an email address.';
  return '';
}

export function validateUserFields(v, { isCreate }) {
  const errors = {};
  const uErr = usernameError(v.username);
  if (uErr) errors.username = uErr;
  if (!trim(v.full_name)) errors.full_name = 'Enter the full name.';
  if (trim(v.email) && !EMAIL_RE.test(trim(v.email))) errors.email = 'Enter a valid email address, or leave it empty.';
  if (trim(v.employee_pin) && !PIN_RE.test(trim(v.employee_pin))) errors.employee_pin = 'Letters, digits and - only (max 20).';
  if (isCreate && (v.password ?? '').length < 8) errors.password = 'Password must be at least 8 characters.';
  if (!ROLES.includes(v.role)) errors.role = 'Choose a role.';
  return errors;
}

export function validateNewPassword(password, confirm) {
  if ((password ?? '').length < 8) return 'New password must be at least 8 characters.';
  if (password !== confirm) return 'The two passwords do not match.';
  return '';
}

export function validateLogin({ username, password }) {
  const errors = {};
  if (!username?.trim()) errors.username = 'Username is required.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}
