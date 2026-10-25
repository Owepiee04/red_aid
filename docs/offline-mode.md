# Offline mode (Level 1)

RedAid keeps working when the signal drops **while the app is already open**.
Opening RedAid for the first time with no signal ("Level 2") is not covered yet;
see [Later](#later-ideas-for-level-2) below.

This is a first, self-contained version. Everything lives in two folders and can
be changed or replaced without touching the rest of the app.

## What the charter sees

| Situation | What happens |
|---|---|
| Signal drops | An amber strip at the top: "You're offline. You can still submit reports…" |
| Taps **Submit** with no signal | "Saved on this phone". The report goes into **Waiting to send** on Home |
| Signal comes back | Saved reports send by themselves (also every 30 s, and when the app comes back to the front). A blue strip says "Sending…" |
| Duty was closed when it arrives (ended more than 30 min ago) | The report stays on the phone marked in red: "This duty is closed… Ask your Team Leader to reopen the duty, then tap Send now." The Team Leader taps **Reopen Duty**, the charter taps **Send now** (or waits; RedAid keeps trying), then the TL ends the duty again |
| App closes / phone locks / page reloads mid-form | The form comes back: "We brought back the report you were filling in". The signature has to be drawn again |
| Taps **Log out** with reports waiting | Warning: they stay on this phone and only send when *that same person* logs in here again |
| Taps **Log out** with no signal | "You're offline. Logging out needs signal." |
| Opens **New Report** with no signal | Works, using the last duty this phone saw online today |

Nothing changed for Team Leaders and Admins except the "You're offline" strip.

## How it works

```
Submit
  └─► saved on the phone first (IndexedDB "outbox")
        └─► try to send now (uploadSignature + submit_report RPC, same as before)
              ├─ sent ...................► removed from the phone ✔
              ├─ no signal / too slow ...► stays "waiting", retried automatically
              └─ server refused .........► online: removed, error shown on the form (same as before)
                                           in the background: kept as "needs_attention" with the reason
```

* **No database change.** The report id is made once on the phone
  (`crypto.randomUUID()`), and `submit_report` returns early if that report
  already exists, so sending the same report twice can never make a duplicate.
* **The 30-minute rule is unchanged.** The server still refuses reports for a
  duty that ended more than 30 minutes ago. The fix is **Reopen Duty** (team
  decision for now).
* A saved report is only ever sent while **the person who wrote it** is logged in.
* The report's `created_at` is when the server received it. The vitals keep the
  times the charter typed.

## Files

### `src/lib/offline/` (logic)

| File | What it does |
|---|---|
| `config.ts` | The on/off switch and timings (retry every 30 s, give up waiting after 15 s, drafts kept 24 h) |
| **`store.ts`** | **The only file that touches IndexedDB / localStorage.** To use your own design (Dexie, different tables, more fields), rewrite this file and keep the function names |
| `outbox.ts` | "The queue": `submitOrQueue()`, `syncQueued()`, `listQueued()`, `deleteQueued()`; one sender at a time (Web Locks) |
| `drafts.ts` | Auto-save of the half-finished New Report form |
| `duty.ts` | `loadTodaysDuty()`: today's duty, or the last one seen online; `tryOnline()` for lists |
| `network.ts` | `isNetworkError()`, `isOffline()`, `useOnline()` |
| `useOutbox.ts` | React hook: the queue for the signed-in person, and auto-sending |
| `types.ts` | `QueuedReport`, `ReportDraft`, `DutySnapshot` |
| `index.ts` | What the rest of the app imports (`@/lib/offline`) |

### `src/components/offline/` (screens)

| File | Where it shows |
|---|---|
| `OfflineBanner.tsx` | Top of every signed-in page (AppShell). **It is also what runs the auto-send**, so there is exactly one |
| `OutboxCard.tsx` | "Waiting to send (n)" on the charter Home, with **Send now** and, for refused reports, **Delete** |
| `useGuardedLogout.tsx` | The logout warning (AppShell and Settings) |

### Small changes to existing files

| File | Change |
|---|---|
| `src/app/charter/report/new/page.tsx` | Submit calls `submitOrQueue()`; draft restore/auto-save; "Saved on this phone" screen; duty via `loadTodaysDuty()` |
| `src/app/charter/page.tsx` | Duty via `loadTodaysDuty()`, lists via `tryOnline()`, shows `<OutboxCard />`, refreshes when the signal is back |
| `src/components/AppShell.tsx` | Shows `<OfflineBanner />`; log out goes through `useGuardedLogout()` |
| `src/components/SettingsView.tsx` | Log out goes through `useGuardedLogout()` |
| `src/contexts/AuthContext.tsx` | If the profile can't load **because there's no signal**, keep the signed-in person on screen instead of signing them out |
| `src/lib/data/reports.ts` | `submitReport` throws `NetworkError` / `ChartingClosedError` (same messages as before) so the queue can tell them apart |
| `next.config.ts` | `experimental.staleTimes.static = 12 h`: pages already opened in the tab stay usable offline. Without it Next.js forgets them after 5 minutes and the phone shows its "No internet" page |

## On-device storage

IndexedDB database `redaid-offline`, version 1:

* `outbox`: one `QueuedReport` per report, key `id` (= `patient_reports.id`),
  index `userId`. Holds the patient details, vitals, care given and the
  signature (PNG data URL) until the server confirms it. Then it's deleted.
* `drafts`: one `ReportDraft` per person, key `userId`. Deleted on submit,
  **Start over**, or after 24 hours.

localStorage `redaid.offline.duty.<userId>`: today's duty as last seen online.
No patient data.

To look at it: Chrome DevTools → **Application** → **IndexedDB** → `redaid-offline`.

## Turning it off

In Vercel → Settings → Environment Variables, add `NEXT_PUBLIC_OFFLINE_MODE` =
`off`, then **redeploy** (NEXT_PUBLIC_ values are built into the app). RedAid then
sends reports straight to the server like before, with no saving on the phone
and no drafts. Delete the variable and redeploy to turn it back on.

## Limits (good to know)

* **Level 1 only.** If RedAid is closed and there's no signal, it can't open.
  Open it while you still have signal and keep it open.
* **iPhone:** Safari may clear a website's storage after about 7 days of not
  being used. Adding RedAid to the Home Screen avoids that. There's no
  background sending on iPhone: RedAid has to be open (or opened again) to send.
* **Android/PC:** sending also only happens while RedAid is open in a tab.
* A browser that blocks storage (some private windows) falls back to the old
  behaviour automatically.

## Testing

On a computer: Chrome DevTools → **Network** → set throttling to **Offline**.
On a phone: airplane mode **after** RedAid is open.

The automated checks used while building this (Playwright against a fake
Supabase) covered:
* queuing offline, opening Home and New Report offline (including 2 hours later)
* auto-send when back online
* a closed duty, then **Send now**
* drafts, both logout warnings
* two people on one phone
* the off switch

## Later ideas (for Level 2)

* **Open RedAid with no signal:** a service worker to cache the app files, plus
  a cached profile in `AuthContext`.
* **Show "written offline at 2:05 PM" to the Team Leader:** add e.g.
  `patient_reports.charted_at` and a `p_charted_at` parameter to
  `submit_report`, and send `QueuedReport.savedAt`.
* **Accept late reports instead of Reopen Duty:** in `submit_report` /
  `is_charting_open`, allow a report whose `charted_at` is before
  `ended_at + 30 min` and that arrives within e.g. 24 h.
