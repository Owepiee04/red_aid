"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
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
import { setCharterVerified } from "@/lib/data/events";
import type { EventPerson } from "@/types/domain";

interface CharterVerifyActionsProps {
  eventId: string;
  person: EventPerson;
  /** Called after a successful change, e.g. to reload the event. */
  onChanged?: () => void;
}

/**
 * Verify / Revoke for one charter on an event (Admin event page).
 * Verify is one tap. Revoke asks first, because it stops that charter from
 * charting on this duty right away. Uses the same database functions as the
 * Team Leader's verify page.
 */
export default function CharterVerifyActions({ eventId, person, onChanged }: CharterVerifyActionsProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const name = person.name || "Charter";

  const run = async (verify: boolean) => {
    setBusy(true);
    try {
      await setCharterVerified(eventId, person.user_id, verify);
      toast({ title: verify ? `${name} verified for this duty` : `${name}'s access revoked` });
      setConfirmRevoke(false);
      onChanged?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: verify ? "Couldn't verify" : "Couldn't revoke",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {person.verified ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirmRevoke(true)}
          aria-label={`Revoke ${name}`}
        >
          <ShieldOff />
          Revoke
        </Button>
      ) : (
        <Button type="button" size="sm" disabled={busy} onClick={() => run(true)} aria-label={`Verify ${name}`}>
          {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Verify
        </Button>
      )}

      <AlertDialog open={confirmRevoke} onOpenChange={(open) => !busy && setConfirmRevoke(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {name}&apos;s access?</AlertDialogTitle>
            <AlertDialogDescription>
              They won&apos;t be able to chart patients on this duty until someone verifies them again.
              Reports they already submitted are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                run(false);
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
