"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import type { AppUser } from "@/types/auth";

interface AuthContextValue {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authChecked: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Supabase Auth only knows the email/password identity (`auth.users`).
// Everything app-specific — name, photo, platform admin flag and default duty
// role — lives in `users`, keyed by the same user id.
interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  pfp_img_url: string | null;
  is_admin: boolean;
  duty_role: "team_leader" | "charter";
  is_active: boolean;
}

async function loadProfile(
  supabase: SupabaseClient,
  session: Session
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, pfp_img_url, is_admin, duty_role, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as UserRow;
  return {
    id: row.id,
    email: session.user.email ?? "",
    full_name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || null,
    role: row.is_admin ? "admin" : "user",
    duty_role: row.duty_role,
    active: row.is_active,
    photo_url: row.pfp_img_url,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const loadFromSession = async (session: Session | null) => {
      if (!session) {
        setUser(null);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }
      const profile = await loadProfile(supabase, session);
      setUser(profile);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadFromSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      loadFromSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  const refreshUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setUser(null);
      return;
    }
    const profile = await loadProfile(supabase, session);
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoadingAuth,
        authChecked,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
