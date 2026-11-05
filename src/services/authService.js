import { supabase } from '../lib/supabaseClient';
import { unwrap } from './errors';

export async function signIn(email, password) {
  const { data } = unwrap(
    await supabase.auth.signInWithPassword({ email: email.trim(), password }),
    'Unable to sign in.',
  );
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
