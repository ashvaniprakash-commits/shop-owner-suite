# Ledger — Multi-tenant shop ledger

A clean, isolated credit & payments ledger. Every account is a fully separate
shop instance — customers, credit entries, payments, and monthly reports are
strictly scoped to the signed-in user.

Stack: **TanStack Start (React 19, Vite 7) + Tailwind v4** on the frontend,
**Supabase** (Postgres + Auth + Storage) on the backend, accessed through a
thin service layer that can be swapped without touching components.

---

## 1. Project setup

```bash
bun install     # or npm install / pnpm install
bun run dev     # starts vite dev server
bun run build   # production build
```

## 2. Environment variables

Configuration lives **only** in `.env` and is consumed by the single Supabase
client at `src/integrations/supabase/client.ts`. Nothing is hardcoded in
components.

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

The **service_role** key is server-only and must **never** appear in any
`VITE_` variable or in client code.

## 3. How to connect Supabase

1. Create a project at supabase.com (or any compatible Postgres+Auth host).
2. Copy the project URL and the **anon/publishable** key into `.env`.
3. Run the SQL from section 4 in the SQL editor.
4. Enable Email auth under **Authentication → Providers**.
5. Restart the dev server.

## 4. How to create database tables

Run this SQL once. It creates the four core tables, a small `updated_at`
trigger, indexes, and the storage bucket for PDF reports.

```sql
-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- customers / credit_entries / payments / monthly_reports
-- (see /supabase/migrations for the full schema)
```

The full migration lives in `supabase/migrations/`. Every table has:

- `id uuid primary key`
- `user_id uuid references auth.users(id) on delete cascade`
- `created_at`, `updated_at` (auto-maintained)

## 5. How to enable RLS

RLS is enabled in the migration. Each table has four owner-scoped policies:

```sql
alter table public.customers enable row level security;
create policy "own customers select" on public.customers
  for select using (auth.uid() = user_id);
create policy "own customers insert" on public.customers
  for insert with check (auth.uid() = user_id);
create policy "own customers update" on public.customers
  for update using (auth.uid() = user_id);
create policy "own customers delete" on public.customers
  for delete using (auth.uid() = user_id);
```

Identical policies apply to `credit_entries`, `payments`, `monthly_reports`,
and to objects in the `reports` storage bucket (scoped by user-id folder).

## 6. How authentication works

- Email + password sign-up, login, forgot-password, and password reset.
- Session is persisted in `localStorage` by Supabase and rehydrated on load.
- `src/lib/auth.tsx` exposes a single `useAuth()` hook used everywhere.
- The pathless layout `src/routes/_authenticated.tsx` redirects unauthenticated
  users to `/login` before any protected page renders.
- Every database query goes through RLS, so even a tampered client cannot read
  another user's rows.

## 7. How to deploy the app

This is a standard Vite app and can deploy to any static host that supports
SSR/edge if needed (Cloudflare Pages, Vercel, Netlify):

```bash
bun run build
# upload the build output to your host
```

Set the same `VITE_SUPABASE_*` env vars in your hosting provider.

## 8. Swapping to another Supabase project

The whole app reads Supabase config from one place. To repoint:

1. Create the new Supabase project.
2. Run the SQL from `supabase/migrations/` in the new project.
3. Update `.env` with the new URL + anon key.
4. Restart the app.

No component, route, or service file imports the URL or key directly — they
all go through `src/integrations/supabase/client.ts` and `src/services/db.ts`.

## 9. Migrating data safely

Recommended order:

1. **Backup first** (section 11).
2. In the source project, export each table:
   `Table Editor → ⋯ → Export to CSV`.
3. In the destination project, **import in this order** to respect FKs:
   `customers` → `credit_entries` → `payments` → `monthly_reports`.
4. Make sure the `user_id` values in the new project map to real `auth.users`
   rows (re-create users first, or use `supabase auth import`).
5. Verify RLS by signing in as a test user and confirming they only see their
   own rows.

## 10. Folder structure

```
src/
  routes/                       # file-based routing
    __root.tsx                  # shell + providers
    index.tsx                   # public landing
    login.tsx, signup.tsx       # auth pages
    forgot-password.tsx
    reset-password.tsx
    _authenticated.tsx          # protected layout (redirect guard + nav)
    _authenticated/
      dashboard.tsx
      customers.tsx
      credits.tsx
      payments.tsx
      reports.tsx
  lib/
    auth.tsx                    # AuthProvider + useAuth() hook
  services/
    db.ts                       # the only file that touches Supabase tables
  integrations/supabase/
    client.ts                   # singleton browser client (auto-generated)
    types.ts                    # generated DB types
  components/ui/                # shadcn-style primitives
  styles.css                    # design tokens (Airbnb-inspired)
supabase/
  migrations/                   # versioned SQL
  config.toml
```

## 11. Backup and restore

**Backup** (run from your local machine with `pg_dump` against the Supabase
connection string from Project Settings → Database):

```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-acl \
  > backup-$(date +%F).sql
```

**Restore** into a fresh project:

```bash
psql "$NEW_SUPABASE_DB_URL" < backup-2025-01-01.sql
```

For storage objects, use `supabase storage cp` or the dashboard's bucket
download.

## 12. Storage bucket setup for PDFs

The migration creates a private bucket called `reports` with per-user folder
isolation. PDFs must be uploaded under the path `<auth.uid()>/<filename>.pdf`
— the storage policies enforce this:

```sql
create policy "own reports storage select" on storage.objects
  for select using (
    bucket_id = 'reports'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
-- + insert / update / delete policies with the same check
```

Upload from the client:

```ts
await supabase.storage
  .from("reports")
  .upload(`${user.id}/${year}-${month}.pdf`, file);
```

## 13. Security best practices

- **Never** ship the `service_role` key. Only the anon/publishable key belongs
  in `VITE_*` variables.
- Keep RLS **on** for every table that contains user data.
- Always filter writes by `user_id = auth.uid()` and rely on the
  `WITH CHECK` policy as a backstop.
- Validate inputs on the client and trust the database to reject anything
  invalid via constraints + RLS.
- Don't disable email confirmation in production unless you understand the
  account-takeover trade-offs.

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "new row violates row-level security policy" | `user_id` missing or different from `auth.uid()` | The service layer in `src/services/db.ts` always sets it from the current session — confirm the user is logged in. |
| "JWT expired" | Stale session | Refresh the page; Supabase auto-refreshes tokens. |
| Empty lists after login | RLS policy missing for that table | Re-run the migration. |
| `Missing Supabase environment variable` at boot | `.env` not loaded | Restart the dev server after editing `.env`. |
| Can see another user's data | RLS disabled or policy uses `true` | Re-enable RLS and re-create the four owner-scoped policies. |

---

## Future flexibility

All database calls live in `src/services/db.ts`. Routes and components only
import from that file. To swap Supabase for Firebase, Appwrite, a self-hosted
Postgres, or any other backend:

1. Re-implement the four service objects (`customersService`,
   `creditsService`, `paymentsService`, `reportsService`) against the new
   provider.
2. Re-implement `src/lib/auth.tsx` against the new auth SDK, keeping the same
   `useAuth()` API.
3. Done — no other file needs to change.
