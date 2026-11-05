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
  if (!CONTACT_RE.test(trim(v.contact))) errors.contact = 'Enter a valid contact number (digits, +, -, spaces).';
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
      if (!v.to) return 'Select an expert.';
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

export function validateNewUser(v) {
  const errors = {};
  if (!trim(v.full_name)) errors.full_name = 'Enter the full name.';
  if (!EMAIL_RE.test(trim(v.email))) errors.email = 'Enter a valid email address.';
  if ((v.password ?? '').length < 8) errors.password = 'Password must be at least 8 characters.';
  if (!ROLES.includes(v.role)) errors.role = 'Choose a role.';
  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email?.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}
