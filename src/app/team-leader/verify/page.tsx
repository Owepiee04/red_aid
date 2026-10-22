"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import UserAvatar from "@/components/UserAvatar";
import EmptyState from "@/components/EmptyState";
import EndDutyControl from "@/components/EndDutyControl";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtDate, fmtTime, todayISO } from "@/lib/formatting";
import { getEvent, getTodaysDuty, setCharterVerified } from "@/lib/data/events";
import type { EventPerson } from "@/types/domain";

// useSearchParams() must sit under a <Suspense> boundary or `next build` fails.
export default function VerifyChartersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyChartersContent />
    </Suspense>
  );
}

function VerifyChartersContent() {
  const { user } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const eventId = useSearchParams().get("eventId");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: event, loading, error, load } = useData(async () => {
    if (!userId) return null;
    if (eventId) return getEvent(eventId);
    const duty = await getTodaysDuty(userId, todayISO(), "team_leader");
    return duty ? getEvent(duty.id) : null;
  }, [eventId, userId]);

  const setVerified = async (person: EventPerson, verify: boolean) => {
    if (!event) return;
    setBusyId(person.user_id);
    try {
      await setCharterVerified(event.id, person.user_id, verify);
      const name = person.name || "Charter";
      toast({
        title: verify ? `${name} verified for this duty` : `${name}'s access revoked`,
      });
      await load();
    } catch (e) {
      toast({
        variant: "destructive",
        title: verify ? "Couldn't verify" : "Couldn't revoke",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !event) return <LoadingState />;

  if (!event) {
    return (
      <div>
        <PageHeader title="Verify Charters" />
        <EmptyState
          title="No duty today"
          description={
            error ?? "You can verify charters once you have an event scheduled for today."
          }
        />
      </div>
    );
  }

  // Someone could paste another event's id into the URL; only leaders of this event may verify.
  if (!event.team_leaders.some((leader) => leader.user_id === userId)) {
    return (
      <div>
        <PageHeader title="Verify Charters" />
        <EmptyState title="Not your duty" description="You aren't a Team Leader on this event." />
      </div>
    );
  }

  const isOver = event.date < todayISO();
  const isEnded = event.ended_at !== null;
  const locked = isOver || isEnded; // no new approvals

  return (
    <div>
      <PageHeader
        title="Verify Charters"
        description={`${event.title} · ${fmtDate(event.date, "MMM D")} at ${fmtTime(event.time)}`}
        actions={isOver ? undefined : <EndDutyControl event={event} onChanged={load} />}
      />

      <p className="mb-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        {isOver
          ? "This duty is already over, so approvals can no longer be changed."
          : isEnded
            ? "This duty has been ended, so charters can't chart and you can't approve more. Reopen it to approve again."
            : "Charters can only chart patients once you verify them here."}
      </p>

      <SectionCard contentClassName="space-y-3">
        {event.charters.length === 0 && (
          <p className="text-sm text-muted-foreground">No charters assigned to this event.</p>
        )}

        {event.charters.map((person) => (
          <div
            key={person.user_id}
            className="flex items-center gap-3 rounded-xl border border-border/70 px-4 py-3"
          >
            <UserAvatar uri={person.photo_url} name={person.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{person.name || "Unnamed"}</p>
              <StatusBadge
                kind="verification"
                status={person.verified ? "verified" : "pending"}
                className="mt-1"
              />
            </div>
            {person.verified ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isOver || busyId === person.user_id}
                onClick={() => setVerified(person, false)}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Revoke
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={locked || busyId === person.user_id}
                onClick={() => setVerified(person, true)}
              >
                <Check className="mr-2 h-4 w-4" />
                Approve
              </Button>
            )}
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
