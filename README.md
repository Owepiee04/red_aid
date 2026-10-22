# RedAid

First-aid charting app for Red Cross Youth duties: Admins schedule events, Team Leaders
verify Charters on duty, and verified Charters file patient reports with vitals and a signature.

Stack: Next.js (App Router) + TypeScript + Tailwind + Supabase (Auth, Postgres with RLS, Storage).
Full project documentation (roles, data model, security, setup, roadmap): `docs/RedAid-Documentation.md`.
Ported from a Base44 prototype; the per-batch conversion notes are in `docs/base44-import/`.

## Branches
- `main`: production. Only release PRs from `develop` and `hotfix/*` land here.
- `develop`: integration. Every `feature/*`, `fix/*`, `chore/*` branch is cut from and merged back into it.

## Database
Migrations live in `supabase/migrations/` and run in filename order.
Apply them with the Supabase CLI (`supabase db push`) or paste them in the SQL editor, oldest first.

## Local setup
1. `cp .env.example .env.local` and fill in the Supabase values.
2. `npm install`
3. `npm run dev`

## Deploying (Vercel + Supabase)
Do these once per Supabase project; skipping any of them breaks login emails or account creation.

1. **Database**: run every file in `supabase/migrations/` in filename order (the newest is
   `20261023000100_my_profile.sql`, which the Settings page needs).
2. **Vercel environment variables** (Project → Settings → Environment Variables):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
   The service-role key is secret: only Vercel and `.env.local` (never Git, never chat).
3. **Supabase Auth URLs** (Authentication → URL Configuration):
   - Site URL: your Vercel address, e.g. `https://redaid.vercel.app`
   - Redirect URLs: add `https://redaid.vercel.app/reset-password` (and
     `http://localhost:3000/reset-password` for local testing).
   Without this, password-reset and invite emails point at localhost.
4. **First Admin**: create the user in Supabase (Authentication → Users → Add user), then in the
   SQL editor:
   ```sql
   insert into public.profiles (id, email, full_name, role)
   select id, email, 'Your Name', 'admin' from auth.users where email = 'you@example.com'
   on conflict (id) do update set role = 'admin';
   ```
   Every other account is created from Admin → Accounts inside the app.
5. Log in on a phone, open the browser menu, and choose **Add to Home Screen** / **Install app**.
