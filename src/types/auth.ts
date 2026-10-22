/**
 * Mirrors the `profiles` table in Supabase (not `auth.users` directly —
 * Supabase Auth owns email/password itself; this is the app-specific row
 * keyed by the same user id). See the roles.js conversion notes: `role`
 * is the platform-level flag (admin vs. regular account), and `duty_role`
 * is the Admin-assigned Team Leader / Charter designation that only
 * applies to non-admin accounts.
 */
export type DutyRole = "team_leader" | "charter";
export type PlatformRole = "admin" | "user";

export interface AppUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: PlatformRole;
  duty_role?: DutyRole | null;
  /** false when an Admin has deactivated the account. */
  active?: boolean;
  /** Storage path in the private `avatars` bucket (or a full URL). */
  photo_url?: string | null;
}
