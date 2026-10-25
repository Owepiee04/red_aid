"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { OFFLINE_MODE_ENABLED, countQueued, isOffline } from "@/lib/offline";

/**
 * Log out, but warn first when reports are still waiting to send, and don't
 * try while offline (logging out needs the server, and the login page can't
 * load without signal).
 *
 *   const { requestLogout, logoutDialog } = useGuardedLogout();
 *   <button onClick={requestLogout}>Log out</button>
 *   {logoutDialog}
 */
export function useGuardedLogout() {
  const { user, logout } = useAuth();
  const [ask, setAsk] = useState<{ count: number; offline: boolean } | null>(null);

  const requestLogout = async () => {
    if (!OFFLINE_MODE_ENABLED) return logout();
    const count = user ? await countQueued(user.id) : 0;
    const offline = isOffline();
    if (count === 0 && !offline) return logout();
    setAsk({ count, offline });
  };

  const reports = (n: number) => `${n} report${n === 1 ? "" : "s"}`;

  const logoutDialog = (
    <AlertDialog open={!!ask} onOpenChange={(open) => !open && setAsk(null)}>
      <AlertDialogContent>
        {ask?.offline ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>You&apos;re offline</AlertDialogTitle>
              <AlertDialogDescription>
                Logging out needs signal. Try again when you&apos;re back online.
                {ask.count > 0 && ` You also have ${reports(ask.count)} waiting to send; they'll go out once you have signal.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>OK</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{ask ? reports(ask.count) : "Reports"} not sent yet</AlertDialogTitle>
              <AlertDialogDescription>
                {ask?.count === 1
                  ? "It's saved on this phone. If you log out, it stays on this phone and only sends the next time "
                  : "They're saved on this phone. If you log out, they stay on this phone and only send the next time "}
                <strong>you</strong> log in here. Check Home to see why {ask?.count === 1 ? "it hasn't" : "they haven't"} sent yet.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay logged in</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setAsk(null);
                  void logout();
                }}
              >
                Log out anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestLogout, logoutDialog };
}
