# BHL Task Management System

A task and ticket tracker for BRAC Healthcare Ltd. teams, with SLAs, a role-based workflow and a full audit trail.
It is built with **React + Vite + Tailwind CSS** on **Supabase** (PostgreSQL, Auth, Realtime and an Edge Function), and deployed to **Cloudflare Workers** (static assets).

## Features

**Sign-in and accounts**
- People sign in with a **username** (any text, 3–50 characters, without "@"). Older accounts can still use their email.
- Each user has a full name, an optional email, an optional **employee PIN** and a designation.
- **Forgot password:** enter your username, and a reset link is emailed to the address on your profile.
- **Change password:** under your name (top right), and it asks for your current password first.

**Permissions.** Admins choose, for each user, which menus and actions they get. The role (Admin, Supervisor, Expert, Management) only sets the default ticks.

| Permission | Gives |
| --- | --- |
| Dashboard, All tasks, My tasks, Audit log, Users & masters | The menu item. "All tasks" also lets the person *see* every task |
| Create tasks | Create tasks. Without "Assign", they can only leave a task unassigned or assign it to themselves |
| Assign / reassign | Assign any task to anyone |
| Manage any task | Edit, close, cancel, add remarks and approve extensions on every task |
| Delete tasks | Permanently delete tasks |

Default ticks per role:
- **Admin:** everything.
- **Supervisor:** everything except Users & masters and Delete.
- **Expert:** My tasks and Dashboard.
- **Management:** Dashboard, All tasks and Audit log.

**The task creator** can always assign their own task to themselves and work on it. They can also edit, close or cancel it, and decide on extension requests for it.

**Tasks**
- Each task gets an ID like `BHL-TASK-2026-000001`, and its fields are:
  - title, details, type and priority
  - center, department and source
  - who raised it, and an optional contact number
  - assignee (any active user) and deadline
- **Statuses:** New → Assigned → Acknowledged → In Progress ⇄ On Hold → Resolved → Closed, or Cancelled.
- **SLA per priority:** Critical 4 h, High 8 h, Medium 2 days, Low 5 days. Each task shows its SLA state, overdue status and aging.
- **History for each task:** resolution details, extension requests and approvals, timeline, worklog, assignment history and deadline history.
- **Assignment emails:** whenever a task is assigned to someone else, they get an email with the task details and a link. Every email is recorded in **Users & masters → Email log**.

**Screens**
- **Dashboard:** 12 KPIs, plus bars by status, by priority, by age of open tasks, and open tasks per assignee.
- **All tasks / My tasks:** search, filters, an overdue-only filter and CSV export. My tasks switches between "Assigned to me" and "Created by me".
- **Audit log, plus Users & masters:**
  - users and their permissions
  - the email log
  - the master lists

## Architecture

```
Browser (React SPA)
 ├─ pages/          Dashboard, Tasks (all / mine), Audit, Admin, Login
 ├─ components/
 │   ├─ tasks/      TaskTable, TaskFilters, TaskDrawer, TaskActionForm, TaskFormModal, taskActions.js
 │   ├─ layout/     AppLayout, Sidebar (role menu), Header
 │   ├─ auth/       ProtectedRoute, RoleRoute
 │   └─ ui/         Button, Modal, Drawer, Badge, BarList, Timeline, Pagination…
 ├─ context/        Auth (session + profile/role), RefData (masters, users, SLA), TaskUI (drawer, realtime), Toast
 ├─ services/       ← the ONLY place that talks to Supabase
 ├─ constants/      statuses, priorities, roles, navigation per role
 └─ utils/          SLA / aging, validation, CSV, formatting
        │  HTTPS + user JWT (publishable key only)
        ▼
Supabase
 ├─ Auth            email + password
 ├─ PostgREST       reads (RLS) + RPC: create_task, task_action, update_task_details,
 │                  admin_update_profile, dashboard_stats
 ├─ PostgreSQL      profiles, tasks, task_worklogs, task_assignments, task_extensions,
 │                  task_audit, master_items, sla_policies
 ├─ Realtime        tasks table
 └─ Edge Function   admin-users (create user, set password; holds the service-role key)
```

**Design decisions**

- **The browser can only read.**
  - Every change goes through a `SECURITY DEFINER` Postgres function.
  - Each function checks the caller's role and the task state, then writes the change and its audit, worklog and history rows in one transaction.
  - So history can't be skipped or faked, even by calling the API directly.
- **Row Level Security:**
  - Experts see only tasks assigned to them or created by them, plus those tasks' history.
  - Inactive users see nothing.
  - Anonymous users are refused everything.
- **Service-role key:** creating users and setting passwords needs this key, so it lives only in the `admin-users` Edge Function. It is never in the browser.
- **The first user in Supabase Auth becomes Admin automatically.** Later users start as Expert.

## 1. Supabase setup

### Database
1. Open **Supabase Dashboard → SQL Editor → New query**.
2. Paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. "Success. No rows returned" means it worked. The script can be re-run safely.
   - It replaces the earlier simple `tasks` table, but only if that table is empty.
   - It seeds the master lists and SLA policies.
   - Users who already exist get a profile, and the oldest becomes **Admin**.

### Edge Functions
There are two functions in `supabase/functions/`. Deploy each one under **Edge Functions → Deploy a new function → Via Editor**:

| Function | Purpose | Verify JWT |
| --- | --- | --- |
| `admin-users` | Create users, set passwords, change usernames (Users & masters only) | on or off; it checks the caller itself |
| `notify` | Assignment emails and password-reset emails | **off**, because the database calls it without a user token |

**Point the database at your functions** (once, in the SQL Editor):
```sql
update app_private.settings set value = 'https://<project-ref>.supabase.co/functions/v1' where key = 'functions_url';
```

### Email sending (assignment emails and password reset)
Supabase Edge Functions can't use SMTP ports, so emails go through an email API.
1. Create a free account with an email API provider:
   - **[Brevo](https://www.brevo.com):** 300 emails a day. You can verify a single sender address without changing any DNS.
   - **[Resend](https://resend.com):** needs a verified domain.
2. In Supabase, go to **Edge Functions → Secrets** and add:
   - `BREVO_API_KEY`, or `RESEND_API_KEY`
   - `MAIL_FROM_EMAIL`: the verified sender address
   - `MAIL_FROM_NAME`: optional, defaults to "BHL Task Management"
   - `APP_URL`: the app's public address, for example `https://taskmanager.<you>.workers.dev`. It's used in email links.
3. Turn off **Allow new users to sign up** under **Authentication → Sign In / Providers**. Accounts are created only by admins.

Until this is set up, the app still works, but assignment emails show as **failed** in the email log, with the reason.

**How usernames work.** Supabase Auth requires an email, so each username gets an internal sign-in address: `u-<hash>@bhl-tasks.invalid`. It is never mailed. A user's real email, if they have one, is stored separately and used only for notifications.

## 2. Run locally

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env.local      # then fill in your values
npm run dev                     # http://localhost:5173
```

`.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

Find both under **Project Settings → API**.

> ⚠️ **Never** use the `service_role` key in this app. Every `VITE_` variable is bundled into public JavaScript.

Other scripts:

```bash
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## 3. Push to GitHub

```bash
git add .
git commit -m "Task Management System: React + Supabase app"
git push origin main
```

`.env*` files (except `.env.example`), `node_modules/` and `dist/` are git-ignored.

## 4. Deploy to Cloudflare (Workers static assets)

The repo includes [`wrangler.jsonc`](wrangler.jsonc), which deploys `dist/` as a Cloudflare Worker with static assets.

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Import a repository** and select this repository.
2. Build settings:

   | Setting        | Value                |
   | -------------- | -------------------- |
   | Build command  | `npm run build`      |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | *(empty)*            |
   | Node version   | from `.nvmrc` (22)   |

   The Worker name in the dashboard must match `"name"` in `wrangler.jsonc` (currently `taskmanager`).
3. Go to **Settings → Builds → Variables and secrets** and add these as **build variables**, then click **Save**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (the publishable or anon key)

   Vite bakes these into the bundle at build time. If they are missing, the app shows a "Supabase is not configured" screen.
4. Every push to `main` rebuilds and redeploys.
5. In Supabase, go to **Authentication → URL Configuration** and add your `*.workers.dev` URL, plus any custom domain, to **Site URL / Redirect URLs**.

How routing works:

- `"not_found_handling": "single-page-application"` in `wrangler.jsonc` serves `index.html` for paths like `/tasks`.
- Don't add a `_redirects` file with `/* /index.html 200`. Workers report that rule as an infinite loop and the deploy fails.
- `public/_headers` adds security headers and long-term caching for hashed assets.

## Project structure

```
├── public/             favicon, _headers
├── wrangler.jsonc      Cloudflare Worker (static assets) config
├── src/                application code (see Architecture)
├── supabase/           schema.sql (tables, RLS, workflow functions), functions/admin-users
├── legacy/             earlier single-file prototype (reference only)
├── .env.example
└── index.html
```
