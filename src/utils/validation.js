import { FIELD_LIMITS, PRIORITY_VALUES, STATUS_VALUES } from '../constants/task';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim strings and collapse empty optional fields to null. */
export function sanitiseTask(input) {
  const trim = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    title: trim(input.title).replace(/\s+/g, ' '),
    description: trim(input.description) || null,
    priority: input.priority,
    status: input.status,
    assigned_to: trim(input.assigned_to) || null,
  };
}

/**
 * Validate a task payload. Returns an object of field -> message;
 * an empty object means the task is valid.
 */
export function validateTask(input) {
  const task = sanitiseTask(input);
  const errors = {};
  const { title, description, assigned_to } = FIELD_LIMITS;

  if (!task.title) errors.title = 'Title is required.';
  else if (task.title.length < title.min)
    errors.title = `Title must be at least ${title.min} characters.`;
  else if (task.title.length > title.max)
    errors.title = `Title must be ${title.max} characters or fewer.`;

  if (task.description && task.description.length > description.max)
    errors.description = `Description must be ${description.max} characters or fewer.`;

  if (!PRIORITY_VALUES.includes(task.priority)) errors.priority = 'Choose a valid priority.';
  if (!STATUS_VALUES.includes(task.status)) errors.status = 'Choose a valid status.';

  if (task.assigned_to && task.assigned_to.length > assigned_to.max)
    errors.assigned_to = `Assignee must be ${assigned_to.max} characters or fewer.`;

  return errors;
}

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email?.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
  return errors;
}
