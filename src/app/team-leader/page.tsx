"use client";

import Link from "next/link";
import { ClipboardList, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import UserAvatar from "@/components/UserAvatar";
import EventCard from "@/components/EventCard";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtDate, fmtTime, todayISO } from "@/lib/formatting";
import { getEvent, getTodaysDuty, listMyEvents } from "@/lib/data/events";
import { countReports } from "@/lib/data/reports";

export default function TeamLeaderDashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, loading, error } = useData(async () => {
    if (!userId) return null;
    const today = todayISO();
    const todaysDuty = await getTodaysDuty(userId, today, "team_leader");

    if (!todaysDuty) {
      const [next] = await listMyEvents({ userId, dutyRole: "team_leader", from: today, limit: 1 });
      return { duty: null, nextDuty: next ?? null, reportsToday: 0 };
    }

    // The people list (and who's verified) comes from the full event record.
    const [duty, reportsToday] = await Promise.all([
      getEvent(todaysDuty.id),
      countReports(undefined, todaysDuty.id),
    ]);
    return { duty, nextDuty: null, reportsToday };
  }, [userId]);

  if (!data && loading) return <LoadingState />;
  if (!data) {
    return <EmptyState title="Couldn't load your dashboard" description={error ?? "Please try again."} />;
  }

  const { duty, nextDuty, reportsToday } = data;

  return (
    <div>
      <PageHeader
        title={`Good day, ${(user?.full_name || "Team Leader").split(" ")[0]}`}
        description="Your duty at a glance."
      />

      <div className="space-y-5">
        <SectionCard
          title={duty ? "On duty today" : "No duty today"}
          subtitle={
            duty
              ? `${fmtDate(duty.date, "dddd, MMM D")} · ${fmtTime(duty.time)}`
              : "You have no event scheduled for today."
          }
        >
          {duty ? (
            <div className="rounded-xl bg-accent/60 p-4">
              <p className="font-heading text-lg font-bold tracking-tight text-accent-foreground">
                {duty.title}
              </p>
              <p className="mt-1 text-sm text-accent-foreground/80">
                {fmtTime(duty.time)}
                {duty.location ? ` · ${duty.location}` : ""}
              </p>
            </div>
          ) : nextDuty ? (
            <div>
              <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Next duty</p>
              <EventCard event={nextDuty} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
          )}
        </SectionCard>

        {duty && (
          <>
            <SectionCard
              title="Charters on this duty"
              subtitle="Approve each charter before they can chart patients"
              action={
                <Button asChild size="sm">
                  <Link href="/team-leader/verify">
                    <UserCheck className="mr-2 h-4 w-4" />
                    Review Charters
                  </Link>
                </Button>
              }
              contentClassName="space-y-3"
            >
              {duty.charters.length === 0 && (
                <p className="text-sm text-muted-foreground">No charters assigned to this event.</p>
              )}
              {duty.charters.map((person) => (
                <div key={person.user_id} className="flex items-center gap-3">
                  <UserAvatar uri={person.photo_url} name={person.name} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {person.name || "Unnamed"}
                  </span>
                  <StatusBadge kind="verification" status={person.verified ? "verified" : "pending"} />
                </div>
              ))}
            </SectionCard>

            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ClipboardList className="h-5 w-5" />
              </span>
              <p className="text-sm">
                <span className="font-heading text-lg font-bold">{reportsToday}</span>{" "}
                <span className="text-muted-foreground">
                  report{reportsToday === 1 ? "" : "s"} submitted on this duty
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
