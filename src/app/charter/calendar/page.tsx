"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import CalendarMonth from "@/components/CalendarMonth";
import SectionCard from "@/components/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtDate, fmtTime, monthBounds, todayISO } from "@/lib/formatting";
import { listMyEvents } from "@/lib/data/events";

export default function CharterCalendarPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const bounds = monthBounds(monthDate);

  const { data: events, error } = useData(
    () => (userId ? listMyEvents({ userId, from: bounds.start, to: bounds.end }) : Promise.resolve([])),
    [bounds.start, bounds.end, userId]
  );

  const dayEvents = (events ?? []).filter((event) => event.date === selectedDate);

  return (
    <div>
      <PageHeader title="Calendar" description="Events you're assigned to." />

      {error && <p className="mb-4 text-sm text-destructive">Couldn&apos;t load events: {error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <CalendarMonth
          monthDate={monthDate}
          onMonthChange={setMonthDate}
          events={events ?? []}
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
