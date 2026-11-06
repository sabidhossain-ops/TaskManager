/**
 * Users sign in with a username. Supabase Auth needs an email, so every
 * username maps to an internal address that is never mailed:
 *   u-<first 40 hex of sha256(lowercase username)>@bhl-tasks.invalid
 * Must match loginEmailFor() in supabase/functions/admin-users/index.ts.
 */
export const LOGIN_DOMAIN = 'bhl-tasks.invalid';

export async function loginEmailFor(username) {
  const data = new TextEncoder().encode(username.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `u-${hex.slice(0, 40)}@${LOGIN_DOMAIN}`;
}

/** A value containing "@" is treated as an email (older accounts); anything else as a username. */
export const toAuthEmail = async (identifier) =>
  identifier.includes('@') ? identifier.trim().toLowerCase() : loginEmailFor(identifier);
