# BHL Task Management System

A task and ticket tracker for BRAC Healthcare Ltd. teams, with SLAs, a role-based workflow and a full audit trail.
It is built with **React + Vite + Tailwind CSS** on **Supabase** (PostgreSQL, Auth, Realtime and an Edge Function), and deployed to **Cloudflare Workers** (static assets).

## Features

**Roles.** Each role sees its own menu.

| Role | Menu | Can do |
| --- | --- | --- |
| Admin | Dashboard, All tasks, My tasks, Audit log, Users & masters | Everything a Supervisor can, plus manage users, master lists and deletions |
| Supervisor | Dashboard, Team tasks, My tasks, Audit log | Create, assign, reassign, edit, close and cancel tasks; approve or reject extensions; add remarks |
| Expert | My tasks, My dashboard | Work on tasks assigned to them: acknowledge, start, hold, resolve, forward, request an extension, add remarks |
| Management | Dashboard, All tasks, Audit log | Read only |

**Tasks**
- Each task gets an ID like `BHL-TASK-2026-000001`, and its fields are:
  - title, details, type and priority
  - center, department and source
  - who raised it and their contact number
  - assignee and deadline
- **Statuses:** New → Assigned → Acknowledged → In Progress ⇄ On Hold → Resolved → Closed. A task can also be Cancelled.
- **SLA per priority:** Critical 4 h, High 8 h, Medium 2 days, Low 5 days. Each task shows Within SLA, At Risk, SLA Met or SLA Breached, plus overdue and aging.
- **Resolution:** a summary, root cause, action taken and preventive action.
- **Deadline extensions:** the expert requests one, and a supervisor approves or rejects it. The original deadline is kept.
- **History for each task:** timeline (audit), worklog, assignment history and deadline history.

**Screens**
- **Dashboard:** 12 KPIs, plus bars by status, by priority, by age of open tasks, and open tasks per expert.
- **Task list:**
  - search by task ID or title
  - filter by status, priority or overdue only
  - pagination, with critical rows highlighted
  - CSV export
- **Audit log:** the latest 200 changes.
- **Users & masters:**
  - create users, set passwords, change role or designation, activate or deactivate
  - edit the master lists: designations, task types, centers, sources, departments and root causes
- **Live updates:** lists and the dashboard refresh when anyone changes a task (Supabase Realtime).

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

### Edge Function (create users, set passwords)
1. Go to **Supabase Dashboard → Edge Functions → Deploy a new function → Via Editor**.
2. Name it **`admin-users`**.
3. Paste in [`supabase/functions/admin-users/index.ts`](supabase/functions/admin-users/index.ts) and click **Deploy**.

Or deploy it with the CLI: `npx supabase functions deploy admin-users --project-ref <ref>`.

Notes:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function automatically.
- If calls fail with "Invalid JWT", turn off **Enforce JWT verification** in the function's settings. The function checks the caller's token and Admin role itself.

Without the function, everything else works. You can then create users under **Authentication → Users → Add user** (tick **Auto Confirm User**) and set their role on the **Users & masters** page.

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
