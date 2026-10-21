"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import CalendarMonth from "@/components/CalendarMonth";
import EventCard from "@/components/EventCard";
import SectionCard from "@/components/SectionCard";
import EventFormDialog from "@/components/EventFormDialog";
import { useData } from "@/lib/useData";
import { fmtDate, monthBounds, todayISO } from "@/lib/formatting";
import { listEventsInRange } from "@/lib/data/events";

export default function CalendarManagementPage() {
  const router = useRouter();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [dialogOpen, setDialogOpen] = useState(false);
  const bounds = monthBounds(monthDate);

  const { data: events, error, load } = useData(
    () => listEventsInRange(bounds.start, bounds.end),
    [bounds.start, bounds.end]
  );

  const dayEvents = (events ?? []).filter((event) => event.date === selectedDate);

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Every duty on the books."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        }
      />

      {error && <p className="mb-4 text-sm text-destructive">Couldn&apos;t load events: {error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <CalendarMonth
          monthDate={monthDate}
          onMonthChange={setMonthDate}
          events={events ?? []}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <SectionCard
          title={fmtDate(selectedDate, "dddd, MMM D")}
          subtitle={
            dayEvents.length
              ? `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""} scheduled`
              : "Nothing scheduled"
          }
          contentClassName="space-y-3"
        >
          {dayEvents.length === 0 && (
            <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No events on this date.
            </p>
          )}
          {dayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => router.push(`/admin/events/${event.id}`)}
            />
          ))}
        </SectionCard>
      </div>

      <EventFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  );
}
