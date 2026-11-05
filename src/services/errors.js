/**
 * Convert Supabase / PostgREST / network errors into
 * short, user-friendly messages.
 */
export function toFriendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  const code = error.code || error.status;
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('failed to fetch') || msg.includes('network'))
    return 'Cannot reach the server. Check your internet connection.';
  if (msg.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('email not confirmed')) return 'Please confirm your email address first.';
  if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied'))
    return 'You do not have permission to do this.';
  if (code === '23514') return 'Some values are not allowed. Check priority and status.';
  if (code === '23505') return 'This record already exists.';
  if (code === '23502') return 'A required field is missing.';
  if (code === '22001') return 'One of the fields is too long.';
  if (code === 'PGRST116') return 'Task not found. It may have been deleted.';
  if (code === '42P01') return 'The tasks table was not found in the database.';
  if (code === 401 || code === 403 || msg.includes('jwt'))
    return 'Your session has expired. Please sign in again.';

  return error.message || fallback;
}

/** Throw a friendly Error if a Supabase response contains an error. */
export function unwrap({ data, error, count }, fallback) {
  if (error) {
    console.error('[supabase]', error);
    const e = new Error(toFriendlyError(error, fallback));
    e.cause = error;
    throw e;
  }
  return { data, count };
}
