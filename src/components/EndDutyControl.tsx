"use client";

import { useState } from "react";
import { Flag, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/components/ui/use-toast";
import { endEvent, reopenEvent } from "@/lib/data/events";
import { CHARTING_GRACE_MINUTES } from "@/lib/duty";
import { todayISO } from "@/lib/formatting";

interface EndDutyControlProps {
  event: { id: string; title: string; date: string; ended_at: string | null };
  /** Called after the duty was ended or reopened, so the page can reload. */
  onChanged?: () => void;
}

/**
 * "End duty" / "Reopen duty" button for Team Leaders and Admins. The database decides
 * who is actually allowed — if someone else presses it they just get an error message.
 */
export default function EndDutyControl({ event, onChanged }: EndDutyControlProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ended = event.ended_at !== null;

  // A duty that hasn't started yet can't be ended.
  if (!ended && event.date > todayISO()) return null;

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    setBusy(true);
    try {
      await action();
      toast({ title: success });
      setConfirmOpen(false);
      onChanged?.();
    } catch (e) {
      setConfirmOpen(false);
      toast({
        variant: "destructive",
        title: failure,
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (ended) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => run(() => reopenEvent(event.id), "Duty reopened", "Couldn't reopen the duty")}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        {busy ? "Reopening…" : "Reopen Duty"}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <Flag className="mr-2 h-4 w-4" />
        End Duty
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End &ldquo;{event.title}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Charters will no longer be able to chart patients for this duty. To avoid losing a
              report someone is in the middle of, they get {CHARTING_GRACE_MINUTES} more minutes.
              Their approvals are kept, and you can reopen the duty if you ended it by mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep Open</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault(); // stay open until the request finishes
                void run(() => endEvent(event.id), "Duty ended", "Couldn't end the duty");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Ending…" : "End Duty"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
