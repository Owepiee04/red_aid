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
   `20261025000400_submit_report.sql`; `20261023001400_app_glue.sql` adds the
   signup trigger and platform-admin flag).
2. **Vercel environment variables** (Project → Settings → Environment Variables):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `REDIRECT_URL`, and
   `SUPABASE_SERVICE_ROLE_KEY`. Set `REDIRECT_URL` to the deployed app URL, for example
   `https://redaid.vercel.app` (never `localhost`; the app ignores a localhost value on Vercel).
   After changing environment variables, **redeploy** (Deployments → ⋯ → Redeploy); Vercel
   only applies them to new deployments.
   The service-role key is secret: only Vercel and `.env.local` (never Git, never chat).
3. **Supabase Auth URLs** (Authentication → URL Configuration). This is what decides where
   email links land:
   - **Site URL**: your Vercel address, e.g. `https://redaid.vercel.app` (not localhost).
   - **Redirect URLs**: add `https://redaid.vercel.app/**` and `http://localhost:3000/**`.
   If the app asks Supabase to redirect somewhere that isn't on this list, Supabase silently
   uses the Site URL instead, so a Site URL of `http://localhost:3000` sends every confirmation
   link to localhost.
4. **First Admin**: create the user in Supabase (Authentication → Users → Add user), then in the
   SQL editor:
   ```sql
   update public.users set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
   Every other account is created from Admin → Accounts inside the app.
5. Log in on a phone, open the browser menu, and choose **Add to Home Screen** / **Install app**.

## Sign-up and email confirmation
Flow: `/signup` → `/verify-email` ("check your inbox", with a resend button) → the person taps
the link in the email → `/auth/confirm` confirms the account → `/login?confirmed=1`, where they
log in with their email and password. Password-reset emails land on `/auth/reset`, which opens
`/reset-password`. (`/auth/callback` still accepts older links and `token_hash` links.)

The pages only use Supabase Auth; creating the matching row in the users table (with
`first_name` / `last_name` from the sign-up metadata) is the schema's job, e.g. a trigger
on `auth.users`. One-time Supabase settings:

1. **Authentication → Providers → Email**: Enable Email provider and turn on **Confirm email**.
2. **Authentication → URL Configuration**: Site URL and Redirect URLs as in
   "Deploying" step 3 above. **Confirm signup** email template: the default `{{ .ConfirmationURL }}` link works (on any
   device). A friendlier version:
   ```html
   <h2>Confirm your RedAid account</h2>
   <p>Tap the button below to confirm your email, then log in with your email and password.</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>
   ```
3. **Custom SMTP (required before real users sign up)**: Supabase's built-in email only
   sends to your project's team members and only a few per hour. Under
   **Project Settings → Authentication → SMTP Settings**, connect a sender such as a Gmail
   account with an App Password, Brevo, or Resend, then raise
   **Authentication → Rate Limits → emails per hour**.
