# Task Management System

A responsive admin dashboard for creating, tracking and updating team tasks.
It is built with **React + Vite + Tailwind CSS** on **Supabase** (PostgreSQL + Auth), and deployed to **Cloudflare Workers** (static assets).

## Features

- **Authentication**: email/password sign-in with Supabase Auth, protected routes and sign-out.
- **Dashboard**: total, pending, in-progress and completed counts, a status breakdown, and recently updated tasks.
- **Tasks**: create, view, edit and delete tasks. Deleting always asks for confirmation.
- **Search and filters**: search by title, description or assignee, and filter by status or priority. These run on the server.
- **Data table**: server-side pagination with a choice of 10, 25 or 50 rows. On phones the table becomes cards.
- **Feedback**: success and error notifications, inline form validation, and friendly database error messages.
- **Security**: Row Level Security, input checks in both the browser and Postgres, and only the public anon key in the browser.

## Architecture

```
Browser (React SPA)
 ├─ pages/          Route screens: Login, Dashboard, Tasks
 ├─ components/
 │   ├─ layout/     AppLayout, Sidebar, Header
 │   ├─ tasks/      TaskTable, TaskFilters, TaskFormModal, TaskDetailModal
 │   ├─ auth/       ProtectedRoute
 │   └─ ui/         Button, Modal, ConfirmDialog, Badge, Pagination, StatCard…
 ├─ context/        AuthContext (session), ToastContext (notifications)
 ├─ services/       ← the ONLY place that talks to Supabase
 │   ├─ taskService.js   list / get / create / update / delete / stats
 │   ├─ authService.js   signIn / signOut / session
 │   └─ errors.js        Postgres/PostgREST error → friendly message
 ├─ constants/      status & priority values, field limits
 ├─ utils/          validation, formatting
 └─ lib/            supabaseClient (reads VITE_ env vars)
          │  HTTPS + user JWT
          ▼
Supabase: Auth ── PostgREST ── PostgreSQL (public.tasks, RLS enabled)
```

**Design decisions**

- UI components never import Supabase. They call `services/`, which keeps data access in one place that is easy to test or swap.
- Pagination, search and filters run in Postgres (`range`, `ilike`, `eq`), so the app stays fast as the table grows.
- Validation runs twice. `utils/validation.js` gives instant feedback, and `CHECK` constraints in Postgres guard the data even if someone calls the API directly.
- `updated_at` is kept current by a database trigger.

## 1. Database setup (Supabase)

1. Open **Supabase Dashboard → SQL Editor**.
2. Run [`supabase/schema.sql`](supabase/schema.sql). It is idempotent and safe on an existing `tasks` table. It adds:
   - check constraints for priority, status and lengths
   - an `updated_at` trigger and indexes
   - **Row Level Security**: anonymous users have no access, and signed-in users can read and write tasks
3. Optional: run [`supabase/seed.sql`](supabase/seed.sql) to add sample tasks.
4. Create users under **Authentication → Users → Add user**. Public sign-up is not exposed in the UI.

> **Existing data:** the app stores `status` as `pending | in_progress | completed` and `priority` as `low | medium | high`.
> If your table already uses different values, such as `Pending` or `In Progress`, change them in `src/constants/task.js` and in the `CHECK` constraints in `schema.sql`.
> `assigned_to` is treated as free text, such as a name or email.

**Optional per-user privacy:** the bottom of `schema.sql` has a commented block. It adds a `created_by` column so each person sees only their own tasks.

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
├── supabase/           schema.sql (tables + RLS), seed.sql
├── legacy/             earlier single-file prototype (reference only)
├── .env.example
└── index.html
```
