"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import CalendarMonth from "@/components/CalendarMonth";
import SectionCard from "@/components/SectionCard";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/lib/useData";
import { fmtDate, fmtDateLong, fmtTime, monthBounds, todayISO } from "@/lib/formatting";
import { listMyEvents } from "@/lib/data/events";

export default function DutyCalendarPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const bounds = monthBounds(monthDate);

  const { data: events, error } = useData(
    () =>
      userId
        ? listMyEvents({ userId, dutyRole: "team_leader", from: bounds.start, to: bounds.end })
        : Promise.resolve([]),
    [bounds.start, bounds.end, userId]
  );

  const dayEvents = (events ?? []).filter((event) => event.date === selectedDate);
  const today = todayISO();

  return (
    <div>
      <PageHeader title="My Duty Calendar" description="Only the duties you lead." />

      {error && <p className="mb-4 text-sm text-destructive">Couldn&apos;t load duties: {error}</p>}

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
              You are not on duty this date.
            </p>
          )}
          {dayEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-border/70 p-4">
              <p className="font-heading text-sm font-semibold">{event.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtDateLong(event.date)} · {fmtTime(event.time)}
                {event.location ? ` · ${event.location}` : ""}
              </p>
              {event.date >= today && (
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link href={`/team-leader/verify?eventId=${event.id}`}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Verify Charters
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </SectionCard>
      </div>
    </div>
  );
}
