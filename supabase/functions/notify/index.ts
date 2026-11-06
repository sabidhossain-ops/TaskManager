// Supabase Edge Function: notify
// Sends emails for:
//   { type: 'assignment', notification_id }  — called by the database (pg_net) when a task is assigned
//   { type: 'password_reset', username }     — called from the "Forgot password" screen
//
// Deploy: Dashboard → Edge Functions → new function "notify" → paste → Deploy,
// then turn OFF "Verify JWT" for this function (the database calls it without a user token).
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   BREVO_API_KEY   or  RESEND_API_KEY   — email provider (one is enough)
//   MAIL_FROM_EMAIL                     — verified sender address
//   MAIL_FROM_NAME                      — optional, default "BHL Task Management"
//   APP_URL                             — the app's public address, e.g. https://taskmanager.example.workers.dev
//
// Safe to call publicly: an assignment email is only sent for a 'queued' row
// (once), and password-reset requests always return the same generic answer
// and are limited to one email per user every 2 minutes.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RESET_REPLY = {
  ok: true,
  message: 'If this username exists and has an email address, a password reset link has been sent to it.',
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(iso))
    : '—';

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
  if (!url || !key) throw new Error('Function is missing its server configuration.');
  return createClient(url, key as string, { auth: { persistSession: false, autoRefreshToken: false } });
}

function appUrl() {
  const url = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/+$/, '');
  if (!url) throw new Error('APP_URL secret is not set.');
  return url;
}

/** Sends one email through Brevo or Resend, whichever key is configured. */
async function sendMail(to: { email: string; name?: string }, subject: string, html: string, text: string) {
  // Tolerate stray spaces / quotes pasted into the secrets
  const env = (k: string) => (Deno.env.get(k) ?? '').trim().replace(/^["']|["']$/g, '').trim();
  const fromEmail = env('MAIL_FROM_EMAIL');
  const fromName = env('MAIL_FROM_NAME') || 'BHL Task Management';
  const brevo = env('BREVO_API_KEY');
  const resend = env('RESEND_API_KEY');
  if (brevo && brevo.startsWith('xsmtpsib-'))
    throw new Error('BREVO_API_KEY is an SMTP key (xsmtpsib-…). Use an API key (xkeysib-…) from Brevo → SMTP & API → API Keys.');
  if (!fromEmail || (!brevo && !resend)) throw new Error('Email provider is not configured (BREVO_API_KEY or RESEND_API_KEY, and MAIL_FROM_EMAIL).');

  const res = brevo
    ? await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevo, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: fromEmail, name: fromName }, to: [to], subject, htmlContent: html, textContent: text }),
      })
    : await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to.email], subject, html, text }),
      });
  if (!res.ok) throw new Error(`Email provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const layout = (title: string, inner: string) => `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Helvetica Neue,Arial,sans-serif;color:#1e293b">
<div style="max-width:560px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
<div style="background:#e2017b;color:#fff;padding:14px 20px;font-weight:bold">BHL Task Management</div>
<div style="padding:20px"><h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>${inner}</div>
<div style="padding:12px 20px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">This is an automated message from BRAC Healthcare Ltd. Task Management.</div>
</div></body></html>`;

async function handleAssignment(admin: ReturnType<typeof serviceClient>, notificationId: number) {
  const { data: n } = await admin.from('notifications').select('*').eq('id', notificationId).maybeSingle();
  if (!n || n.status !== 'queued' || n.kind !== 'assignment') return { skipped: true };

  try {
    const [{ data: task }, { data: asg }] = await Promise.all([
      admin.from('tasks').select('id, task_no, title, description, priority, task_type, center, deadline, raised_by').eq('id', n.task_id).single(),
      admin.from('task_assignments').select('assigned_by, reason').eq('id', n.assignment_id).single(),
    ]);
    const ids = [n.recipient, asg?.assigned_by].filter(Boolean);
    const { data: people } = await admin.from('profiles').select('id, full_name').in('id', ids);
    const name = (id: string) => people?.find((p) => p.id === id)?.full_name ?? '';
    const link = `${appUrl()}/my-tasks?task=${task.id}`;

    const rows = [
      ['Task', `${task.task_no} — ${task.title}`],
      ['Priority', task.priority],
      ['Type', task.task_type],
      ['Center', task.center],
      ['Deadline', fmt(task.deadline)],
      ['Raised by', task.raised_by],
      ['Assigned by', name(asg?.assigned_by)],
      ...(asg?.reason && asg.reason !== 'Initial assignment' ? [['Note', asg.reason]] : []),
    ];
    const html = layout(
      `A task has been assigned to you`,
      `<p>Hello ${esc(name(n.recipient))},</p>
       <table style="border-collapse:collapse;width:100%;font-size:14px">${rows
         .map(([k, v]) => `<tr><td style="padding:6px 8px;color:#64748b;width:120px;vertical-align:top">${esc(k)}</td><td style="padding:6px 8px">${esc(v)}</td></tr>`)
         .join('')}</table>
       ${task.description ? `<p style="white-space:pre-wrap;background:#f8fafc;padding:10px;border-radius:8px;font-size:14px">${esc(task.description)}</p>` : ''}
       <p><a href="${esc(link)}" style="display:inline-block;background:#e2017b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Open the task</a></p>`,
    );
    const text = `Hello ${name(n.recipient)},\n\nA task has been assigned to you.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nOpen: ${link}`;

    await sendMail({ email: n.email, name: name(n.recipient) }, `[BHL Task] ${task.task_no} assigned to you: ${task.title}`, html, text);
    await admin.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', n.id);
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from('notifications').update({ status: 'failed', error: msg.slice(0, 500) }).eq('id', n.id);
    return { failed: msg };
  }
}

async function handlePasswordReset(admin: ReturnType<typeof serviceClient>, usernameRaw: unknown) {
  const username = String(usernameRaw ?? '').trim();
  if (username.length < 3 || username.length > 50) return;

  const { data: matches } = await admin.from('profiles').select('id, full_name, email, active').ilike('username', escapeLike(username));
  const p = matches?.[0];
  if (!p || !p.active || !p.email) return;

  // At most one reset email per user every 2 minutes
  const since = new Date(Date.now() - 2 * 60000).toISOString();
  const { data: recent } = await admin
    .from('notifications')
    .select('id')
    .eq('recipient', p.id)
    .eq('kind', 'password_reset')
    .gte('created_at', since);
  if (recent?.length) return;

  const { data: row } = await admin
    .from('notifications')
    .insert({ kind: 'password_reset', recipient: p.id, email: p.email, status: 'queued' })
    .select('id')
    .single();

  try {
    const { data: au, error: auErr } = await admin.auth.admin.getUserById(p.id);
    if (auErr || !au?.user?.email) throw new Error('Auth user not found.');
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email: au.user.email });
    if (linkErr) throw linkErr;
    const url = `${appUrl()}/reset-password?token_hash=${encodeURIComponent(link.properties.hashed_token)}`;

    const html = layout(
      'Reset your password',
      `<p>Hello ${esc(p.full_name)},</p>
       <p>We received a request to reset the password for username <b>${esc(username)}</b>. The link works once and expires soon.</p>
       <p><a href="${esc(url)}" style="display:inline-block;background:#e2017b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px">Choose a new password</a></p>
       <p style="font-size:13px;color:#64748b">If you did not ask for this, you can ignore this email.</p>`,
    );
    await sendMail({ email: p.email, name: p.full_name }, 'Reset your BHL Task Management password', html,
      `Hello ${p.full_name},\n\nReset your password for username "${username}":\n${url}\n\nIf you did not ask for this, ignore this email.`);
    await admin.from('notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row!.id);
  } catch (e) {
    await admin.from('notifications').update({ status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 500) }).eq('id', row!.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const admin = serviceClient();
    const body = await req.json().catch(() => ({}));

    if (body.type === 'assignment') {
      const id = Number(body.notification_id);
      if (!Number.isInteger(id)) return json({ error: 'notification_id is required.' }, 400);
      return json(await handleAssignment(admin, id));
    }
    if (body.type === 'password_reset') {
      await handlePasswordReset(admin, body.username);
      return json(RESET_REPLY); // same answer whether or not the user exists
    }
    return json({ error: 'Unknown type.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error.' }, 500);
  }
});
