/**
 * The outbox ("the queue"): submitted reports saved on the phone until the
 * server confirms them.
 *
 *   Submit ──► saved on the phone first ──► try to send ──► sent? remove it
 *                                               │
 *                     no signal ────────────────┤──► stays "waiting"; retried when back online
 *                     server refused (e.g. duty closed) ──► "needs_attention" with the reason
 *
 * Sending reuses the normal path (uploadSignature + submitReport → the
 * submit_report RPC). The report id is made once per form, so sending the same
 * report twice can never create a duplicate: no database change was needed.
 */
import { ChartingClosedError, submitReport } from "@/lib/data/reports";
import { uploadSignature } from "@/lib/storage";
import { OFFLINE_MODE_ENABLED, SLOW_SEND_MS } from "./config";
import { isNetworkError, isOffline } from "./network";
import * as store from "./store";
import type { QueuedReport, QueuedReportInput } from "./types";

// ---------------------------------------------------------------------------
// Change notifications (so every screen showing the queue updates)
// ---------------------------------------------------------------------------

const CHANGE_EVENT = "redaid:outbox-change";
const SENT_EVENT = "redaid:outbox-sent";

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Calls `listener` whenever a saved report is added, sent, updated or deleted. Returns unsubscribe. */
export function onOutboxChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}

/** Calls `listener` when a saved report reaches the server (e.g. to refresh a list). Returns unsubscribe. */
export function onReportSent(listener: () => void): () => void {
  window.addEventListener(SENT_EVENT, listener);
  return () => window.removeEventListener(SENT_EVENT, listener);
}

// ---------------------------------------------------------------------------
// One sender at a time (also across browser tabs, where supported)
// ---------------------------------------------------------------------------

let localChain: Promise<unknown> = Promise.resolve();

/** Runs `fn` while no other send is running. With `skipIfBusy`, returns null instead of waiting. */
async function withSendLock<T>(fn: () => Promise<T>, skipIfBusy = false): Promise<T | null> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("redaid-outbox-send", { ifAvailable: skipIfBusy }, (lock) =>
      lock ? fn() : null
    ) as Promise<T | null>;
  }
  const next = localChain.then(fn, fn);
  localChain = next.catch(() => undefined);
  return next;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

type SendResult = { kind: "sent" } | { kind: "no_signal" } | { kind: "refused"; error: Error };

function explain(error: Error): string {
  if (error instanceof ChartingClosedError) {
    return "This duty is closed for new reports (it was ended, or you're no longer verified). Ask your Team Leader to reopen the duty or verify you again, then tap Send now.";
  }
  return `${error.message} Tap Send now to try again.`;
}

async function sendOne(item: QueuedReport): Promise<SendResult> {
  try {
    let signaturePath = item.signaturePath;
    if (!signaturePath) {
      signaturePath = await uploadSignature(item.userId, item.id, item.signature);
      // Remember it: if the next step fails, the retry won't upload the picture again.
      await store.putQueuedReport({ ...item, signaturePath }).catch(() => undefined);
    }
    await submitReport({ ...item.input, signaturePath });
    await store.deleteQueuedReport(item.id);
    emitChange();
    window.dispatchEvent(new Event(SENT_EVENT));
    return { kind: "sent" };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const noSignal = isNetworkError(error);
    // Only update it if it's still there (another screen may have deleted it).
    const current = await store.getQueuedReport(item.id).catch(() => null);
    if (current) {
      await store
        .putQueuedReport({
          ...current,
          attempts: current.attempts + 1,
          lastTriedAt: new Date().toISOString(),
          status: noSignal ? current.status : "needs_attention",
          problem: noSignal ? current.problem : explain(error),
        })
        .catch(() => undefined);
      emitChange();
    }
    return noSignal ? { kind: "no_signal" } : { kind: "refused", error };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NewReport {
  userId: string;
  eventTitle: string;
  input: QueuedReportInput;
  signature: string;
}

/**
 * "sent"   = the server has it (same as before offline mode).
 * "queued" = saved on the phone; it will send automatically.
 * Throws (like before) when the server refuses it, e.g. the duty is closed, so
 * the charter stays on the form and sees why.
 */
export type SubmitOutcome = "sent" | "queued";

async function sendDirectly(report: NewReport): Promise<SubmitOutcome> {
  const signaturePath = await uploadSignature(report.userId, report.input.id, report.signature);
  await submitReport({ ...report.input, signaturePath });
  return "sent";
}

/** What the New Report screen calls when the charter taps Submit. */
export async function submitOrQueue(report: NewReport): Promise<SubmitOutcome> {
  if (!OFFLINE_MODE_ENABLED) return sendDirectly(report);

  const item: QueuedReport = {
    id: report.input.id,
    userId: report.userId,
    eventTitle: report.eventTitle,
    input: report.input,
    signature: report.signature,
    savedAt: new Date().toISOString(),
    attempts: 0,
    lastTriedAt: null,
    status: "waiting",
    problem: null,
  };

  // 1. Save it on the phone first, so nothing is lost if the send fails or the app closes.
  try {
    const existing = await store.getQueuedReport(item.id);
    await store.putQueuedReport(
      existing
        ? {
            ...existing,
            input: item.input,
            signature: item.signature,
            signaturePath: existing.signature === item.signature ? existing.signaturePath : null,
          }
        : item
    );
    emitChange();
    void store.requestPersistentStorage();
  } catch {
    // This browser can't store it: behave exactly like before offline mode.
    return sendDirectly(report);
  }

  if (isOffline()) return "queued";

  // 2. Try to send it now. On a slow connection, stop waiting after SLOW_SEND_MS;
  //    the send carries on in the background.
  const sending = withSendLock(async () => {
    const current = await store.getQueuedReport(item.id);
    return current ? sendOne(current) : ({ kind: "sent" } as SendResult); // already sent by the background sync
  });
  const slow = new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), SLOW_SEND_MS));
  const result = await Promise.race([sending, slow]);

  if (result === "slow" || result === null) return "queued";
  if (result.kind === "sent") return "sent";
  if (result.kind === "no_signal") return "queued";

  // 3. The server refused it: take it back out of the queue and show the error on
  //    the form, like before (the form, and its draft, still have everything).
  await store.deleteQueuedReport(item.id).catch(() => undefined);
  emitChange();
  throw result.error;
}

/** This person's saved reports, oldest first ([] if storage isn't available). */
export async function listQueued(userId: string): Promise<QueuedReport[]> {
  if (!OFFLINE_MODE_ENABLED) return [];
  return store.listQueuedReports(userId).catch(() => []);
}

export async function countQueued(userId: string): Promise<number> {
  return (await listQueued(userId)).length;
}

/** Permanently removes a saved report that was never sent. */
export async function deleteQueued(id: string): Promise<void> {
  await store.deleteQueuedReport(id);
  emitChange();
}

export interface SyncSummary {
  sent: number;
  left: number;
}

/**
 * Tries to send all of this person's saved reports, oldest first. Stops at the
 * first "no signal". Reports the server refused are tried again every time (a
 * Team Leader may have reopened the duty since). Skips if a send is already running.
 */
export async function syncQueued(userId: string): Promise<SyncSummary | null> {
  if (!OFFLINE_MODE_ENABLED || isOffline()) return null;
  return withSendLock(async () => {
    const items = await store.listQueuedReports(userId).catch(() => []);
    let sent = 0;
    for (const item of items) {
      const result = await sendOne(item);
      if (result.kind === "sent") sent++;
      if (result.kind === "no_signal") break;
    }
    return { sent, left: items.length - sent };
  }, true);
}
