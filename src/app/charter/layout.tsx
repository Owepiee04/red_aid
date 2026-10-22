import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

// Every page under /charter shares this frame (navigation, logout) and is
// only shown to signed-in Charter accounts. See AppShell for the redirects.
export default function CharterLayout({ children }: { children: ReactNode }) {
  return <AppShell role="charter">{children}</AppShell>;
}
