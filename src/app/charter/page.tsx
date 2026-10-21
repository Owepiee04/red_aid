"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EventCard from "@/components/EventCard";
import ReportCardList from "@/components/ReportCardList";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtTime, todayISO } from "@/lib/formatting";
import { getTodaysDuty, listMyEvents } from "@/lib/data/events";
import { listReports } from "@/lib/data/reports";

export default function CharterHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  const { data, loading, error } = useData(async () => {
    if (!userId) return null;
    const today = todayISO();
    const [duty, upcoming, recent] = await Promise.all([
      getTodaysDuty(userId, today),
      listMyEvents({ userId, from: today, limit: 5 }),
      listReports({ charterId: userId, includeDrafts: true, limit: 5 }),
    ]);
    return { duty, verified: duty?.verified ?? false, upcoming, recent };
  }, [userId]);

  if (!data && loading) return <LoadingState />;
  if (!data) {
    return <EmptyState title="Couldn't load your dashboard" description={error ?? "Please try again."} />;
  }

  const { duty, verified, upcoming, recent } = data;

  return (
    <div>
      <PageHeader
        title={`Good day, ${(user?.full_name || "Charter").split(" ")[0]}`}
        description="Your duty status and recent charting."
      />

      <div className="space-y-5">
        <div
          className={
            !duty
              ? "flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
              : verified
                ? "flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
                : "flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5"
          }
        >
          {!duty ? (
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          ) : verified ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className="font-heading text-base font-semibold">
              {!duty
                ? "No duty today"
                : verified
                  ? "Approved — you can chart"
                  : "Waiting for Team Leader approval"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {!duty
                ? "You have no event assigned to you today."
                : verified
                  ? `${duty.title} · ${fmtTime(duty.time)}${duty.location ? ` · ${duty.location}` : ""}`
                  : "You'll be able to chart once your Team Leader verifies you for this duty."}
            </p>
          </div>
        </div>

        {verified ? (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/charter/report/new">
              <Plus className="mr-2 h-5 w-5" />
              New Report
            </Link>
          </Button>
        ) : (
          <Button size="lg" disabled className="w-full sm:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            New Report
          </Button>
        )}

        <SectionCard title="Upcoming Events" contentClassName="space-y-3">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming events assigned to you.</p>
          )}
          {upcoming.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </SectionCard>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold tracking-tight">Recent Reports</h2>
            <Link href="/charter/reports" className="text-sm font-medium text-primary hover:opacity-70">
              View all
            </Link>
          </div>
          <ReportCardList
            reports={recent}
            onOpen={(report) => router.push(`/charter/reports/${report.id}`)}
            emptyTitle="You haven't charted yet"
          />
        </div>
      </div>
    </div>
  );
}
