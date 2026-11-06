// Supabase Edge Function: admin-users
// Creates users, sets passwords and changes usernames. These need the
// service key, which must never reach the browser.
//
// Deploy: Dashboard → Edge Functions → admin-users → Code → paste → Deploy.
//
// Body (caller must be an active user with the "menu.admin" permission):
//   { action: 'create', username, full_name, password, role, designation?, email?, employee_pin? }
//   { action: 'set_password', user_id, password }
//   { action: 'set_username', user_id, username }
//
// Sign-in uses usernames. Supabase Auth still needs an email, so each user gets
// an internal address u-<sha256(username)>@bhl-tasks.invalid (never mailed).
// The browser computes the same address at sign-in (src/lib/loginEmail.js).
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOGIN_DOMAIN = 'bhl-tasks.invalid';
const ROLES = ['Admin', 'Supervisor', 'Expert', 'Management'];
const ALL_PERMISSIONS = ['menu.dashboard', 'menu.all_tasks', 'menu.my_tasks', 'menu.audit', 'menu.admin', 'task.create', 'task.assign', 'task.manage', 'task.delete'];
const ROLE_PRESETS: Record<string, string[]> = {
  Admin: ALL_PERMISSIONS,
  Supervisor: ['menu.dashboard', 'menu.all_tasks', 'menu.my_tasks', 'menu.audit', 'task.create', 'task.assign', 'task.manage'],
  Management: ['menu.dashboard', 'menu.all_tasks', 'menu.audit'],
  Expert: ['menu.my_tasks', 'menu.dashboard'],
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN_RE = /^[A-Za-z0-9-]{1,20}$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function loginEmailFor(username: string) {
  const data = new TextEncoder().encode(username.trim().toLowerCase());
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `u-${hash.slice(0, 40)}@${LOGIN_DOMAIN}`;
}

function usernameError(u: string) {
  if (u.length < 3 || u.length > 50) return 'Username must be 3–50 characters.';
  if (u.includes('@')) return 'Username cannot contain "@" (it is not an email address).';
  return '';
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) {
    try {
      const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
      key = keys.default ?? Object.values(keys)[0];
    } catch {
      /* not set */
    }
  }
  if (!url || !key) return null;
  return createClient(url, key as string, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const admin = serviceClient();
    if (!admin) return json({ error: 'Function is missing its server configuration.' }, 500);

    // Caller must be an active user with the Users & masters permission
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Please sign in again.' }, 401);
    const { data: caller } = await admin.from('profiles').select('active, permissions').eq('id', userData.user.id).maybeSingle();
    if (!caller?.active || !(caller.permissions ?? []).includes('menu.admin')) {
      return json({ error: 'Only administrators can manage users.' }, 403);
    }

    const body = await req.json().catch(() => ({}));

    const usernameTaken = async (username: string, exceptId?: string) => {
      let q = admin.from('profiles').select('id').ilike('username', escapeLike(username));
      if (exceptId) q = q.neq('id', exceptId);
      const { data } = await q;
      return (data ?? []).length > 0;
    };

    // ---- Create a user -------------------------------------------------
    if (body.action === 'create') {
      const username = String(body.username ?? '').trim();
      const fullName = String(body.full_name ?? '').trim();
      const password = String(body.password ?? '');
      const role = String(body.role ?? 'Expert');
      const designation = String(body.designation ?? '').trim() || null;
      const email = String(body.email ?? '').trim().toLowerCase() || null;
      const pin = String(body.employee_pin ?? '').trim() || null;
      const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : ROLE_PRESETS[role];

      const uErr = usernameError(username);
      if (uErr) return json({ error: uErr }, 400);
      if (!fullName || fullName.length > 100) return json({ error: 'Enter the full name.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if (!ROLES.includes(role)) return json({ error: 'Choose a valid role.' }, 400);
      if (email && !EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address, or leave it empty.' }, 400);
      if (pin && !PIN_RE.test(pin)) return json({ error: 'Employee PIN can contain letters, digits and - (max 20).' }, 400);
      if (!permissions || permissions.some((p: string) => !ALL_PERMISSIONS.includes(p))) return json({ error: 'Unknown permission.' }, 400);
      if (await usernameTaken(username)) return json({ error: 'This username is already taken.' }, 400);
      if (pin) {
        const { data } = await admin.from('profiles').select('id').ilike('employee_pin', escapeLike(pin));
        if ((data ?? []).length) return json({ error: 'Another user already has this employee PIN.' }, 400);
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: await loginEmailFor(username),
        password,
        email_confirm: true,
        user_metadata: { username, full_name: fullName, contact_email: email, employee_pin: pin, designation },
      });
      if (error) {
        const msg = /already|exists|registered/i.test(error.message) ? 'This username is already taken.' : error.message;
        return json({ error: msg }, 400);
      }

      const { error: profileError } = await admin
        .from('profiles')
        .update({ username, full_name: fullName, role, permissions, designation, email, employee_pin: pin })
        .eq('id', data.user.id);
      if (profileError) return json({ error: 'User created, but the profile could not be updated: ' + profileError.message }, 500);
      return json({ id: data.user.id });
    }

    // ---- Set a user's password ----------------------------------------
    if (body.action === 'set_password') {
      const userId = String(body.user_id ?? '');
      const password = String(body.password ?? '');
      if (!userId) return json({ error: 'Choose a user.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---- Change a username (also moves the internal sign-in address) ---
    if (body.action === 'set_username') {
      const userId = String(body.user_id ?? '');
      const username = String(body.username ?? '').trim();
      const uErr = usernameError(username);
      if (!userId) return json({ error: 'Choose a user.' }, 400);
      if (uErr) return json({ error: uErr }, 400);
      if (await usernameTaken(username, userId)) return json({ error: 'This username is already taken.' }, 400);

      const { error } = await admin.auth.admin.updateUserById(userId, { email: await loginEmailFor(username), email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: pErr } = await admin.from('profiles').update({ username }).eq('id', userId);
      if (pErr) return json({ error: pErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});
