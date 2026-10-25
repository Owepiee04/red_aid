/**
 * Offline mode settings. See docs/offline-mode.md.
 *
 * The on/off switch: set NEXT_PUBLIC_OFFLINE_MODE=off in Vercel (Settings →
 * Environment Variables) and redeploy, and RedAid goes back to sending reports
 * straight to the server like before (no saving on the phone, no drafts).
 * Anything else, or not set at all, means ON.
 */
export const OFFLINE_MODE_ENABLED = process.env.NEXT_PUBLIC_OFFLINE_MODE !== "off";

/** How often to retry sending saved reports while the app is open and online. */
export const SYNC_RETRY_MS = 30_000;

/**
 * If sending takes longer than this (weak signal), the New Report screen stops
 * waiting and says the report is saved on the phone. The send keeps going in
 * the background, and is safe to repeat (same report id = no duplicate).
 */
export const SLOW_SEND_MS = 15_000;

/** A half-finished form older than this is thrown away instead of restored. */
export const DRAFT_MAX_AGE_HOURS = 24;
