"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Lock, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EventCard from "@/components/EventCard";
import ReportCardList from "@/components/ReportCardList";
import LoadingState from "@/components/LoadingState";
import OutboxCard from "@/components/offline/OutboxCard";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { chartingClosesAt, isChartingOpen } from "@/lib/duty";
import { fmtDate, fmtTime, todayISO } from "@/lib/formatting";
import { listMyEvents } from "@/lib/data/events";
import { listReports } from "@/lib/data/reports";
import { loadTodaysDuty, onOutboxChange, tryOnline } from "@/lib/offline";

export default function CharterHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id;

  const { data, loading, error, load } = useData(async () => {
    if (!userId) return null;
    const today = todayISO();
    // Offline mode: with no signal, today's duty is the last one seen online
    // (so New Report still works) and the two lists are left empty.
    const [todays, upcoming, recent] = await Promise.all([
      loadTodaysDuty(userId, today),
      tryOnline(() => listMyEvents({ userId, from: today, limit: 5 }), []),
      tryOnline(() => listReports({ charterId: userId, includeDrafts: true, limit: 5 }), []),
    ]);
    return { duty: todays.duty, offline: todays.offline, upcoming, recent };
  }, [userId]);

  // Refresh when the signal comes back and when a saved report is sent.
  useEffect(() => {
    const reloadIfOnline = () => {
      if (navigator.onLine) void load();
    };
    window.addEventListener("online", reloadIfOnline);
    const stop = onOutboxChange(reloadIfOnline);
    return () => {
      window.removeEventListener("online", reloadIfOnline);
      stop();
    };
  }, [load]);

  if (!data && loading) return <LoadingState />;
  if (!data) {
    return <EmptyState title="Couldn't load your dashboard" description={error ?? "Please try again."} />;
  }

  const { duty, offline, upcoming, recent } = data;

  // none     = nothing assigned today
  // ended    = the Team Leader ended the duty (and any grace period is over, or you weren't approved)
  // approved = you can chart (including the grace period right after the duty was ended)
  // waiting  = assigned, but the Team Leader hasn't approved you yet
  const canChart = duty ? isChartingOpen(duty) : false;
  const state = !duty ? "none" : canChart ? "approved" : duty.ended_at ? "ended" : "waiting";
  const closesAt = duty ? chartingClosesAt(duty) : null;
  const dutyLine = duty
    ? `${duty.title} · ${fmtTime(duty.time)}${duty.location ? ` · ${duty.location}` : ""}`
    : "";

  const BANNER = {
    none: {
      box: "border-border bg-card shadow-sm",
      icon: <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />,
      title: "No duty today",
      body: "You have no event assigned to you today.",
    },
    waiting: {
      box: "border-amber-200 bg-amber-50",
      icon: <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />,
      title: "Waiting for Team Leader approval",
      body: "You'll be able to chart once your Team Leader verifies you for this duty.",
    },
    approved: {
      box: "border-emerald-200 bg-emerald-50",
      icon: <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />,
      title: "Approved — you can chart",
      body: closesAt
        ? `${dutyLine}. Your Team Leader has ended this duty — charting closes at ${fmtDate(closesAt, "h:mm A")}.`
        : dutyLine,
    },
    ended: {
      box: "border-border bg-muted/60",
      icon: <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />,
      title: "Duty ended",
      body: `${duty?.title ?? "This duty"} has been ended by your Team Leader, so new reports can't be added.`,
    },
  }[state];

  return (
    <div>
      <PageHeader
        title={`Good day, ${(user?.full_name || "Charter").split(" ")[0]}`}
        description="Your duty status and recent charting."
      />

      <div className="space-y-5">
        <div className={`flex items-start gap-3 rounded-2xl border p-5 ${BANNER.box}`}>
          {BANNER.icon}
          <div>
            <p className="font-heading text-base font-semibold">{BANNER.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{BANNER.body}</p>
          </div>
        </div>

        {canChart ? (
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

        <OutboxCard />

        <SectionCard title="Upcoming Events" contentClassName="space-y-3">
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {offline ? "Upcoming events will show when you're back online." : "No upcoming events assigned to you."}
            </p>
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
            emptyTitle={offline ? "Your reports will show when you're back online" : "You haven't charted yet"}
          />
        </div>
      </div>
    </div>
  );
}
