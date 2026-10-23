/**
 * App-side view of `public.users` plus the Supabase Auth email.
 * `role` is the platform-level flag (admin vs. regular account), and
 * `duty_role` is the account's default Team Leader / Charter designation.
 * Per-event roles live in `event_members.member_role`.
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
