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
// Everything app-specific — role, duty_role, full_name — lives in a
// `profiles` table keyed by the same user id, so every auth change has to
// be followed by a fetch of that row before `user` is usable.
async function loadProfile(
  supabase: SupabaseClient,
  session: Session
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, duty_role")
    .eq("id", session.user.id)
    .single();

  if (error || !data) return null;
  return data as AppUser;
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
