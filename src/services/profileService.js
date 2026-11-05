import { supabase } from '../lib/supabaseClient';
import { unwrap } from './errors';

const COLUMNS = 'id, full_name, email, designation, role, active, created_at';

export async function getMyProfile(userId) {
  const { data } = unwrap(
    await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle(),
    'Unable to load your profile.',
  );
  return data;
}

export async function listProfiles() {
  const { data } = unwrap(
    await supabase.from('profiles').select(COLUMNS).order('full_name'),
    'Unable to load users.',
  );
  return data ?? [];
}

/** Admin only: change name, role, designation or active flag. */
export async function adminUpdateProfile(id, patch) {
  const { data } = unwrap(
    await supabase.rpc('admin_update_profile', { p_id: id, p: patch }),
    'Unable to update the user.',
  );
  return data;
}

/** Calls the `admin-users` Edge Function (holds the service-role key server-side). */
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
      message = 'The "admin-users" Edge Function is not deployed yet. See README → Edge Function.';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const createUser = ({ full_name, email, password, role, designation }) =>
  invokeAdminUsers({ action: 'create', full_name, email, password, role, designation });

export const setUserPassword = (userId, password) =>
  invokeAdminUsers({ action: 'set_password', user_id: userId, password });
