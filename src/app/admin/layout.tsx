import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

// Every page under /admin shares this frame (navigation, logout) and is
// only shown to signed-in Admin accounts. See AppShell for the redirects.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell role="admin">{children}</AppShell>;
}
