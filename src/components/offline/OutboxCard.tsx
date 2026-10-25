"use client";

import { useState } from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/SectionCard";
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
import { deleteQueued, useOutbox, type QueuedReport } from "@/lib/offline";
import { fmtDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";

/**
 * "Waiting to send" on the charter's home: reports saved on this phone that the
 * server doesn't have yet. Hidden when there are none.
 */
export default function OutboxCard() {
  const { user } = useAuth();
  const { items, online, syncing, syncNow } = useOutbox(user?.id);
  const [toDelete, setToDelete] = useState<QueuedReport | null>(null);

  if (items.length === 0) return null;

  return (
    <SectionCard
      title={`Waiting to send (${items.length})`}
      subtitle={
        !online
          ? "Saved on this phone. They'll send automatically when you have signal. Keep RedAid open, or open it again later."
          : items.every((i) => i.status === "needs_attention")
            ? "Saved on this phone, but RedAid couldn't accept them yet. The reason is below; RedAid keeps trying."
            : "Saved on this phone. Sending automatically…"
      }
      action={
        <Button size="sm" variant="outline" onClick={() => syncNow()} disabled={!online || syncing}>
          {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Send now
        </Button>
      }
      contentClassName="p-0"
    >
      <ul className="divide-y divide-border/70">
        {items.map((item) => {
          const attention = item.status === "needs_attention";
          return (
            <li key={item.id} className="flex items-start gap-3 px-5 py-4">
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  attention ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                )}
              >
                {attention ? <AlertTriangle className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold">
                  {item.input.patient_name || "Unnamed patient"}
                  <span className="font-normal text-muted-foreground"> · {item.input.chief_complaint}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.eventTitle} · saved {fmtDate(item.savedAt, "h:mm A")}
                  {attention ? "" : " · waiting for signal"}
                </p>
                {attention && item.problem && <p className="mt-1.5 text-xs font-medium text-red-700">{item.problem}</p>}
              </div>
              {attention && (
                <button
                  type="button"
                  onClick={() => setToDelete(item)}
                  aria-label={`Delete the unsent report for ${item.input.patient_name}`}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this unsent report?</AlertDialogTitle>
            <AlertDialogDescription>
              The report for {toDelete?.input.patient_name || "this patient"} was never received by RedAid. Deleting
              it removes it from this phone for good. If the duty was closed, ask your Team Leader to reopen it and
              tap Send now instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) void deleteQueued(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
