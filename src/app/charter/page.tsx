"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Lock, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EventCard from "@/components/EventCard";
import ReportCardList from "@/components/ReportCardList";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { chartingClosesAt, isChartingOpen } from "@/lib/duty";
import { fmtDate, fmtTime, todayISO } from "@/lib/formatting";
import { checkConnection } from "@/lib/connectivity";
import { listMyEvents, todaysDutyFrom } from "@/lib/data/events";
import { listReports } from "@/lib/data/reports";
import { cacheMyEvents, getCachedMyEvents } from "@/lib/indexed-db/cacheEvents";
import { getReportHistorySource } from "@/lib/report-history";

export default function CharterHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.id;
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (reachable: boolean) => {
      if (!cancelled) setOnline(reachable);
    };

    const refresh = async () => {
      apply(await checkConnection());
    };

    void refresh();
    const onOnline = () => void refresh();
    const onOffline = () => apply(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const homeKey = userId && online !== null ? `${userId}:${online}` : null;
  const homeKeyRef = useRef(homeKey);
  homeKeyRef.current = homeKey;
  const [loadedHomeKey, setLoadedHomeKey] = useState<string | null>(null);

  const { data, loading, error } = useData(async () => {
    if (!homeKey || !userId || online === null) return null;
    try {
      const today = todayISO();

      if (online) {
        const [events, recent] = await Promise.all([
          listMyEvents({ userId, limit: 500 }),
          listReports({ charterId: userId, includeDrafts: true, limit: 5 }),
        ]);
        await cacheMyEvents(events);
        return {
          duty: todaysDutyFrom(events, today),
          upcoming: events.filter((event) => event.date >= today).slice(0, 5),
          recent,
        };
      }

      const [events, recent] = await Promise.all([
        getCachedMyEvents(),
        getReportHistorySource(false).listReports(userId, "all"),
      ]);
      return {
        duty: todaysDutyFrom(events, today),
        upcoming: events.filter((event) => event.date >= today).slice(0, 5),
        recent: recent.slice(0, 5),
      };
    } finally {
      if (homeKeyRef.current === homeKey) setLoadedHomeKey(homeKey);
    }
  }, [homeKey, userId, online]);

  const pageLoading = homeKey === null || loading || loadedHomeKey !== homeKey;

  if (pageLoading) return <LoadingState />;
  if (error || !data) {
    return <EmptyState title="Couldn't load your dashboard" description={error ?? "Please try again."} />;
  }

  const { duty, upcoming, recent } = data;

  // none     = nothing assigned today
  // ended    = the Team Leader ended the duty (and any grace period is over, or you weren't approved)
  // approved = you can chart (including the grace period right after the duty was ended)
  // waiting  = assigned, but the Team Leader hasn't approved you yet
  const canChart = duty ? isChartingOpen(duty) : false;
  const state = !duty ? "none" : canChart ? "approved" : duty.ended_at ? "ended" : "waiting";
  const closesAt = duty ? chartingClosesAt(duty) : null;
  const dutyLine = duty
    ? `${duty.title}${duty.time ? ` · ${fmtTime(duty.time)}` : ""}${duty.location ? ` · ${duty.location}` : ""}`
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
