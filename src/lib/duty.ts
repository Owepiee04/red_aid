import dayjs from "dayjs";

/**
 * Legacy grace window kept for the old duty-ended UI. The current schema has no
 * ended_at column, so events mapped from it always stay open.
 */
export const CHARTING_GRACE_MINUTES = 30;

interface DutyLike {
  verified: boolean;
  ended_at: string | null;
}

export const hasEnded = (event: { ended_at: string | null }): boolean => event.ended_at !== null;

/** The moment charting stops for an ended duty, or null if it hasn't been ended. */
export function chartingClosesAt(event: { ended_at: string | null }): Date | null {
  return event.ended_at ? dayjs(event.ended_at).add(CHARTING_GRACE_MINUTES, "minute").toDate() : null;
}

/**
 * Can this charter chart right now? Approved, and the duty is either still open or
 * was ended less than CHARTING_GRACE_MINUTES ago. (The database makes the final call;
 * this only decides what the screens show.)
 */
export function isChartingOpen(event: DutyLike, now: number = Date.now()): boolean {
  if (!event.verified) return false;
  const closes = chartingClosesAt(event);
  return closes === null || now < closes.getTime();
}
