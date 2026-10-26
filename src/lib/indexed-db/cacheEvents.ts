import { getEvents, saveEvents } from "./Event";
import type { CachedEvent } from "./types";
import type { MyEvent } from "@/types/domain";

function toCachedEvent(event: MyEvent): CachedEvent {
  return {
    eventId: event.id,
    eventName: event.title,
    eventLocation: event.location ?? "",
    eventDate: event.date,
    eventDescription: event.description ?? "",
    isVerified: event.verified,
  };
}

function fromCachedEvent(event: CachedEvent): MyEvent {
  return {
    id: event.eventId,
    title: event.eventName,
    date: event.eventDate,
    time: null,
    location: event.eventLocation || null,
    description: event.eventDescription || null,
    created_by: null,
    ended_at: null,
    ended_by: null,
    created_at: `${event.eventDate}T00:00:00.000Z`,
    updated_at: `${event.eventDate}T00:00:00.000Z`,
    name: event.eventName,
    verified: event.isVerified,
  };
}

export async function cacheMyEvents(events: MyEvent[]): Promise<void> {
  await saveEvents(events.map(toCachedEvent)).catch(() => undefined);
}

export async function getCachedMyEvents(): Promise<MyEvent[]> {
  const events = await getEvents();
  return events
    .map(fromCachedEvent)
    .sort((a, b) => `${a.date}T${a.time ?? "00:00"}`.localeCompare(`${b.date}T${b.time ?? "00:00"}`));
}
