# RedAid auth batch — setup notes

Converted from the Base44 export: Login, ForgotPassword, ResetPassword, RoleHome,
plus the shared AuthLayout/RedAidLogo/ui components and AuthContext/roles they depend on.
Dropped per our earlier decisions: OAuthConsent.jsx, Register.jsx, Google sign-in.

## 1. Install dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr clsx tailwind-merge class-variance-authority @radix-ui/react-slot @radix-ui/react-label lucide-react
```

## 2. Environment variables

Add to `.env.local` (and to Vercel's project settings):

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Both come from your Supabase project's Settings -> API page.

## 3. Create the `profiles` table in Supabase

Password/email live in Supabase's own `auth.users` table — you never touch that
directly. App-specific fields (role, duty_role, name) go in a `profiles` table keyed
by the same user id, which is what AuthContext.tsx queries after every login.

Run this in the Supabase SQL editor:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  duty_role text check (duty_role in ('team_leader', 'charter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A signed-in user can read their own profile row.
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);
```

You'll add more RLS policies later for Admin-level access (reading/editing other
users' profiles) once the Manage Accounts page exists.

**Auto-create a profile row on signup:** since there's no public self-registration,
you (the Admin) will be creating accounts directly — either via Supabase's dashboard
or a future "Add New +" flow that calls `supabase.auth.admin.createUser()` from a
server-side route. Either way, pair it with an insert into `profiles` with the
matching id, or set up a Postgres trigger on `auth.users` insert that creates the
`profiles` row automatically. Happy to help wire that up when you build Manage
Accounts.

## 4. Wrap the app in AuthProvider

In your root `src/app/layout.tsx`, wrap `{children}` with the provider so
`useAuth()` works anywhere:

```tsx
import { AuthProvider } from "@/contexts/AuthContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

## 5. Tailwind tokens this code assumes

These classes (`bg-primary`, `text-primary-foreground`, `bg-destructive`,
`bg-card`, `border-border`, `text-muted-foreground`, etc.) are the shadcn/ui-style
CSS variable convention. If your `globals.css` doesn't already define them, say so
and I'll give you the `@theme` block matching your Red Cross red (#ED1C24).

## 6. Still open

- `/admin`, `/team-leader`, `/charter` routes don't exist yet — that's the next
  batch (dashboards), once you send those Base44 files.
- RLS policies for Admin reading/editing other profiles aren't written yet —
  needed before Manage Accounts can work.
