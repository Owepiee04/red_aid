/**
 * Offline mode (Level 1): RedAid keeps working when the signal drops while the
 * app is already open. Start with docs/offline-mode.md.
 *
 *   config.ts     on/off switch and timings
 *   store.ts      the ONLY file that touches IndexedDB/localStorage (swap this to change storage)
 *   outbox.ts     "the queue": save a submitted report on the phone, send it, retry
 *   drafts.ts     auto-save of the half-finished New Report form
 *   duty.ts       today's duty, with the last-seen copy when offline
 *   network.ts    "is this a no-signal error?" and useOnline()
 *   useOutbox.ts  React hook for screens that show the queue
 *
 * Screens: src/components/offline/*.
 */
export { OFFLINE_MODE_ENABLED } from "./config";
export { submitOrQueue, listQueued, countQueued, deleteQueued, syncQueued, onOutboxChange, onReportSent } from "./outbox";
export type { SubmitOutcome } from "./outbox";
export { saveDraft, loadDraft, clearDraft } from "./drafts";
export { loadTodaysDuty, tryOnline } from "./duty";
export { isNetworkError, isOffline, useOnline } from "./network";
export { useOutbox } from "./useOutbox";
export type { QueuedReport, ReportDraft } from "./types";
