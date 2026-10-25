"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import UserAvatar from "@/components/UserAvatar";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import EventFormDialog from "@/components/EventFormDialog";
import EndDutyControl from "@/components/EndDutyControl";
import ExportEventButton from "@/components/ExportEventButton";
import CharterVerifyActions from "@/components/CharterVerifyActions";
import { useData } from "@/lib/useData";
import { fmtDateLong, fmtDateTimeStamp, fmtTime } from "@/lib/formatting";
import { getEvent } from "@/lib/data/events";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const { data: event, loading, error, load } = useData(() => getEvent(id), [id]);

  if (loading && !event) return <LoadingState />;
  if (!event) {
    return (
      <EmptyState title="Event not found" description={error ?? "It may have been deleted."} />
    );
  }

  return (
    <div>
      <PageHeader
        title={event.title}
        description={`${fmtDateLong(event.date)} · ${fmtTime(event.time)}`}
        actions={
          <>
            <ExportEventButton event={event} />
            <EndDutyControl event={event} onChanged={load} />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Event
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        <SectionCard title="Event details">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Date</dt>
              <dd className="mt-0.5 text-sm font-medium">{fmtDateLong(event.date)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Time</dt>
              <dd className="mt-0.5 text-sm font-medium">{fmtTime(event.time)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</dt>
              <dd className="mt-0.5 text-sm font-medium">{event.location || "—"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Duty status</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {event.ended_at ? `Ended ${fmtDateTimeStamp(event.ended_at)}` : "Open"}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm">{event.description || "—"}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Team Leader(s)" contentClassName="space-y-3">
          {event.team_leaders.length === 0 && (
            <p className="text-sm text-muted-foreground">No team leaders assigned.</p>
          )}
          {event.team_leaders.map((person) => (
            <div key={person.user_id} className="flex items-center gap-3">
              <UserAvatar uri={person.photo_url} name={person.name} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{person.name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">Team Leader</p>
              </div>
              <span className="rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                Team Leader
              </span>
            </div>
          ))}
        </SectionCard>

        <SectionCard
          title="Assigned Charters"
          subtitle="Verified charters can chart patients on this duty. Verify or revoke them here."
          contentClassName="space-y-3"
        >
          {event.charters.length === 0 && (
            <p className="text-sm text-muted-foreground">No charters assigned.</p>
          )}
          {event.charters.map((person) => (
            <div key={person.user_id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/admin/accounts/${person.user_id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-muted/50"
              >
                <UserAvatar uri={person.photo_url} name={person.name} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{person.name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">Charter</p>
                </div>
                <StatusBadge kind="verification" status={person.verified ? "verified" : "pending"} />
              </button>
              <CharterVerifyActions eventId={event.id} person={person} onChanged={load} />
            </div>
          ))}
        </SectionCard>
      </div>

      <EventFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        onSaved={load}
        onDeleted={() => router.push("/admin/calendar")}
      />
    </div>
  );
}
