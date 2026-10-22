import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

// Every page under /team-leader shares this frame (navigation, logout) and is
// only shown to signed-in Team Leader accounts. See AppShell for the redirects.
export default function TeamLeaderLayout({ children }: { children: ReactNode }) {
  return <AppShell role="team_leader">{children}</AppShell>;
}
