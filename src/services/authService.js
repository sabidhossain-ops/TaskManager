import { supabase } from '../lib/supabaseClient';
import { toAuthEmail } from '../lib/loginEmail';
import { unwrap } from './errors';

/** Sign in with a username (or, for older accounts, an email). */
export async function signIn(identifier, password) {
  const email = await toAuthEmail(identifier);
  const { data } = unwrap(await supabase.auth.signInWithPassword({ email, password }), 'Unable to sign in.');
  return data;
}

export async function signOut() {
  unwrap(await supabase.auth.signOut(), 'Unable to sign out.');
}

export async function getSession() {
  const { data } = unwrap(await supabase.auth.getSession());
  return data.session;
}

export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/** Signed-in user changes their password; the current password is checked first. */
export async function changePassword(currentPassword, newPassword) {
  const { data: s } = await supabase.auth.getSession();
  const email = s.session?.user?.email;
  if (!email) throw new Error('Please sign in again.');
  const check = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (check.error) throw new Error('Your current password is incorrect.');
  unwrap(await supabase.auth.updateUser({ password: newPassword }), 'Unable to change the password.');
}

/** "Forgot password": the notify Edge Function emails a reset link to the address on file. */
export async function requestPasswordReset(username) {
  const { data, error } = await supabase.functions.invoke('notify', { body: { type: 'password_reset', username } });
  if (error) {
    if (error.context?.status === 404) throw new Error('Password reset is not set up yet. Ask an administrator to reset your password.');
    throw new Error('Could not send the request. Please try again.');
  }
  return data?.message;
}

/** Reset link → temporary session. */
export async function verifyRecoveryToken(tokenHash) {
  unwrap(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }), 'This reset link is invalid or has expired.');
}

export async function setNewPassword(password) {
  unwrap(await supabase.auth.updateUser({ password }), 'Unable to set the new password.');
}
