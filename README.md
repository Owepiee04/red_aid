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
