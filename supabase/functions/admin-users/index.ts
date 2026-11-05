// Supabase Edge Function: admin-users
// Creates users and sets passwords. These need the service-role key, which
// must never reach the browser, so they run here on the server.
//
// Deploy: Supabase Dashboard → Edge Functions → Deploy a new function →
// name it "admin-users" and paste this file. (Or: npx supabase functions deploy admin-users)
//
// Body: { action: 'create', email, password, full_name, role, designation }
//       { action: 'set_password', user_id, password }
import { createClient } from 'npm:@supabase/supabase-js@2';

const ROLES = ['Admin', 'Supervisor', 'Expert', 'Management'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    // Legacy service-role key, or the newer secret key (SUPABASE_SECRET_KEYS = {"default": "sb_secret_..."})
    let serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      try {
        const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
        serviceKey = keys.default ?? Object.values(keys)[0];
      } catch {
        /* not set */
      }
    }
    if (!url || !serviceKey) return json({ error: 'Function is missing its server configuration.' }, 500);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // 1. Who is calling? Must be an active Admin.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Please sign in again.' }, 401);

    const { data: caller } = await admin.from('profiles').select('role, active').eq('id', userData.user.id).maybeSingle();
    if (!caller || caller.role !== 'Admin' || !caller.active) {
      return json({ error: 'Only administrators can manage users.' }, 403);
    }

    const body = await req.json().catch(() => ({}));

    // 2. Create a user
    if (body.action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const fullName = String(body.full_name ?? '').trim();
      const role = String(body.role ?? 'Expert');
      const designation = String(body.designation ?? '').trim() || null;

      if (!fullName || fullName.length > 100) return json({ error: 'Enter the full name.' }, 400);
      if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      if (!ROLES.includes(role)) return json({ error: 'Choose a valid role.' }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, designation },
      });
      if (error) {
        const msg = /already|exists|registered/i.test(error.message) ? 'A user with this email already exists.' : error.message;
        return json({ error: msg }, 400);
      }

      // The database trigger created the profile as Expert; apply the chosen role.
      const { error: profileError } = await admin
        .from('profiles')
        .update({ full_name: fullName, role, designation })
        .eq('id', data.user.id);
      if (profileError) return json({ error: `User created, but the profile could not be updated: ${profileError.message}` }, 500);

      return json({ id: data.user.id });
    }

    // 3. Set a user's password
    if (body.action === 'set_password') {
      const userId = String(body.user_id ?? '');
      const password = String(body.password ?? '');
      if (!userId) return json({ error: 'Choose a user.' }, 400);
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});
