/**
 * Auto-save for the New Report form, so a report being filled in comes back
 * if the app closes, the phone locks, or the page reloads.
 *
 * One draft per person. The signature is NOT saved: the charter signs again
 * after a restore (the signature pad can't be pre-filled).
 */
import { DRAFT_MAX_AGE_HOURS, OFFLINE_MODE_ENABLED } from "./config";
import * as store from "./store";
import type { ReportDraft } from "./types";

export async function saveDraft(draft: Omit<ReportDraft, "savedAt">): Promise<void> {
  if (!OFFLINE_MODE_ENABLED) return;
  await store.putDraft({ ...draft, savedAt: new Date().toISOString() }).catch(() => undefined);
}

/** The person's draft for this duty, or null. Old drafts and other duties' drafts are discarded. */
export async function loadDraft(userId: string, eventId: string): Promise<ReportDraft | null> {
  if (!OFFLINE_MODE_ENABLED) return null;
  const draft = await store.getDraft(userId).catch(() => null);
  if (!draft) return null;
  const ageHours = (Date.now() - new Date(draft.savedAt).getTime()) / 3_600_000;
  if (draft.eventId !== eventId || !(ageHours < DRAFT_MAX_AGE_HOURS)) {
    await clearDraft(userId);
    return null;
  }
  return draft;
}

export async function clearDraft(userId: string): Promise<void> {
  await store.deleteDraft(userId).catch(() => undefined);
}
