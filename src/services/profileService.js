import { supabase } from '../lib/supabaseClient';
import { unwrap } from './errors';

const COLUMNS = 'id, username, full_name, email, employee_pin, designation, role, permissions, active, created_at';

export async function getMyProfile(userId) {
  const { data } = unwrap(
    await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle(),
    'Unable to load your profile.',
  );
  return data;
}

export async function listProfiles() {
  const { data } = unwrap(await supabase.from('profiles').select(COLUMNS).order('full_name'), 'Unable to load users.');
  return data ?? [];
}

/** Users & masters: change name, email, PIN, designation, role, permissions or active flag. */
export async function adminUpdateProfile(id, patch) {
  const { data } = unwrap(
    await supabase.rpc('admin_update_profile', { p_id: id, p: patch }),
    'Unable to update the user.',
  );
  return data;
}

/** Latest emails (assignment, password reset) — Users & masters only. */
export async function listNotifications(limit = 30) {
  const { data } = unwrap(
    await supabase
      .from('notifications')
      .select('id, kind, email, status, error, created_at, sent_at, recipient, task:tasks(id, task_no)')
      .order('created_at', { ascending: false })
      .limit(limit),
    'Unable to load the email log.',
  );
  return data ?? [];
}

/** Calls the `admin-users` Edge Function (holds the service key server-side). */
async function invokeAdminUsers(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let message = error.message;
    const status = error.context?.status;
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {
      /* response was not JSON */
    }
    if (status === 404 || error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError')
      message = 'The "admin-users" Edge Function is not deployed yet. See README → Edge Functions.';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const createUser = (u) =>
  invokeAdminUsers({
    action: 'create',
    username: u.username.trim(),
    full_name: u.full_name.trim(),
    email: u.email?.trim() || null,
    employee_pin: u.employee_pin?.trim() || null,
    password: u.password,
    role: u.role,
    designation: u.designation || null,
  });

export const setUserPassword = (userId, password) => invokeAdminUsers({ action: 'set_password', user_id: userId, password });

export const setUsername = (userId, username) => invokeAdminUsers({ action: 'set_username', user_id: userId, username: username.trim() });
