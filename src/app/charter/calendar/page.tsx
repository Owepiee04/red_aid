"use client";

import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import CalendarMonth from "@/components/CalendarMonth";
import SectionCard from "@/components/SectionCard";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtDate, fmtTime, monthBounds, todayISO } from "@/lib/formatting";
import { checkConnection } from "@/lib/connectivity";
import { listMyEvents } from "@/lib/data/events";
import { cacheMyEvents, getCachedMyEvents } from "@/lib/indexed-db/cacheEvents";

export default function CharterCalendarPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [online, setOnline] = useState<boolean | null>(null);
  const bounds = monthBounds(monthDate);

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

  const calendarKey = userId && online !== null ? `${userId}:${online}` : null;
  const calendarKeyRef = useRef(calendarKey);
  calendarKeyRef.current = calendarKey;
  const [loadedCalendarKey, setLoadedCalendarKey] = useState<string | null>(null);

  const { data: events, loading, error } = useData(async () => {
    if (!calendarKey || !userId || online === null) return [];
    try {
      if (online) {
        const all = await listMyEvents({ userId, limit: 500 });
        await cacheMyEvents(all);
        return all;
      }
      return await getCachedMyEvents();
    } finally {
      if (calendarKeyRef.current === calendarKey) setLoadedCalendarKey(calendarKey);
    }
  }, [calendarKey, userId, online]);

  const pageLoading = calendarKey === null || loading || loadedCalendarKey !== calendarKey;

  if (pageLoading) return <LoadingState />;

  const monthEvents = (events ?? []).filter((event) => event.date >= bounds.start && event.date <= bounds.end);
  const dayEvents = (events ?? []).filter((event) => event.date === selectedDate);

  return (
    <div>
      <PageHeader title="Calendar" description="Events you're assigned to." />

      {error && <p className="mb-4 text-sm text-destructive">Couldn&apos;t load events: {error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <CalendarMonth
          monthDate={monthDate}
          onMonthChange={setMonthDate}
          events={monthEvents}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <SectionCard title={fmtDate(selectedDate, "dddd, MMM D")} contentClassName="space-y-3">
          {dayEvents.length === 0 && (
            <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              You&apos;re not assigned to an event on this date.
            </p>
          )}
          {dayEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-border/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-heading text-sm font-semibold">{event.title}</p>
                <span className="shrink-0 rounded-full border border-primary/20 bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  Assigned
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtTime(event.time)}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
