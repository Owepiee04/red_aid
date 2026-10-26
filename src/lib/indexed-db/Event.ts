import { describeDbError, getDB } from "./db";
import type { CachedEvent } from "./types";

/**
 * Replaces the local event cache with the current list. Events that are no longer
 * returned by Supabase (unassigned, deleted, etc.) disappear from the cache too.
 */
export async function saveEvents(events: CachedEvent[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("Event", "readwrite");
    await tx.objectStore("Event").clear();
    for (const event of events) {
      await tx.objectStore("Event").put(event);
    }
    await tx.done;
  } catch (error) {
    throw describeDbError("cache the events", error);
  }
}

export async function getEvents(): Promise<CachedEvent[]> {
  try {
    const db = await getDB();
    const events = await db.getAll("Event");
    return events.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  } catch (error) {
    throw describeDbError("load cached events", error);
  }
}

export async function getEventById(eventId: string): Promise<CachedEvent | null> {
  try {
    const db = await getDB();
    return (await db.get("Event", eventId)) ?? null;
  } catch (error) {
    throw describeDbError("load the cached event", error);
  }
}
