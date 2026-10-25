/**
 * Today's duty, with a fallback for when there's no signal: the last duty this
 * phone saw online. The server still makes the final call when the report is
 * sent (e.g. if the duty was ended while the charter was offline).
 */
import { getTodaysDuty } from "@/lib/data/events";
import type { MyEvent } from "@/types/domain";
import { OFFLINE_MODE_ENABLED } from "./config";
import { isNetworkError, isOffline } from "./network";
import * as store from "./store";

/**
 * Supabase retries failed reads (about 7 seconds in total) before giving up.
 * Don't make a charter with a patient wait that long: after this, use the
 * saved duty and let the real answer update it in the background.
 */
const DUTY_WAIT_MS = 4_000;

export interface TodaysDuty {
  duty: MyEvent | null;
  /** true = no signal; this is the last duty seen online. */
  offline: boolean;
}

export async function loadTodaysDuty(userId: string, today: string): Promise<TodaysDuty> {
  const fresh = getTodaysDuty(userId, today).then((duty) => {
    if (OFFLINE_MODE_ENABLED) store.putDutySnapshot({ userId, date: today, duty, savedAt: new Date().toISOString() });
    return duty;
  });
  if (!OFFLINE_MODE_ENABLED) return { duty: await fresh, offline: false };

  const snapshot = store.getDutySnapshot(userId);
  const saved = snapshot && snapshot.date === today ? snapshot : null;
  fresh.catch(() => undefined); // may finish after we've stopped waiting

  if (saved && isOffline()) return { duty: saved.duty, offline: true };

  const slow = new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), DUTY_WAIT_MS));
  try {
    const result = saved ? await Promise.race([fresh, slow]) : await fresh;
    if (result === "slow") return { duty: saved!.duty, offline: true };
    return { duty: result, offline: false };
  } catch (e) {
    if (saved && isNetworkError(e)) return { duty: saved.duty, offline: true };
    throw e;
  }
}

/**
 * For other lists on a page: returns `fallback` straight away when the phone is
 * offline, or when the request fails for lack of signal.
 */
export async function tryOnline<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  if (OFFLINE_MODE_ENABLED && isOffline()) return fallback;
  try {
    return await load();
  } catch (e) {
    if (OFFLINE_MODE_ENABLED && isNetworkError(e)) return fallback;
    throw e;
  }
}
