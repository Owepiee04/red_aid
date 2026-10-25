/**
 * THE ONLY FILE THAT TALKS TO THE PHONE'S STORAGE.
 *
 * Everything else in src/lib/offline goes through the functions below. To use
 * a different design (Dexie, other table names, more fields...), rewrite this
 * file and keep these function names and types; nothing else has to change.
 *
 * Storage used:
 *   IndexedDB database "redaid-offline" (version 1)
 *     - object store "outbox": QueuedReport, key = id, index "userId"
 *     - object store "drafts": ReportDraft, key = userId (one draft per person)
 *   localStorage "redaid.offline.duty.<userId>": DutySnapshot (no patient data)
 *
 * All functions throw if the browser can't store data (e.g. some private
 * windows); callers then fall back to the normal online-only behaviour.
 */
import type { DutySnapshot, QueuedReport, ReportDraft } from "./types";

const DB_NAME = "redaid-offline";
const DB_VERSION = 1;
const OUTBOX = "outbox";
const DRAFTS = "drafts";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser can't save reports on the device."));
  }
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: "id" }).createIndex("userId", "userId");
      }
      if (!db.objectStoreNames.contains(DRAFTS)) {
        db.createObjectStore(DRAFTS, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgraded the database: close so it isn't blocked, reopen next time.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error("Couldn't open the on-device storage."));
    };
  });
  return dbPromise;
}

/** Runs one request in its own transaction and resolves when it is committed. */
async function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result as T);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new Error("On-device storage was interrupted."));
  });
}

// ---------------------------------------------------------------------------
// Outbox: submitted reports waiting to be sent
// ---------------------------------------------------------------------------

export async function putQueuedReport(item: QueuedReport): Promise<void> {
  await run(OUTBOX, "readwrite", (s) => s.put(item));
}

export async function getQueuedReport(id: string): Promise<QueuedReport | null> {
  return (await run<QueuedReport | undefined>(OUTBOX, "readonly", (s) => s.get(id))) ?? null;
}

/** This person's saved reports, oldest first. */
export async function listQueuedReports(userId: string): Promise<QueuedReport[]> {
  const items = await run<QueuedReport[]>(OUTBOX, "readonly", (s) => s.index("userId").getAll(userId));
  return items.sort((a, b) => a.savedAt.localeCompare(b.savedAt));
}

export async function deleteQueuedReport(id: string): Promise<void> {
  await run(OUTBOX, "readwrite", (s) => s.delete(id));
}

// ---------------------------------------------------------------------------
// Drafts: the New Report form being filled in
// ---------------------------------------------------------------------------

export async function putDraft(draft: ReportDraft): Promise<void> {
  await run(DRAFTS, "readwrite", (s) => s.put(draft));
}

export async function getDraft(userId: string): Promise<ReportDraft | null> {
  return (await run<ReportDraft | undefined>(DRAFTS, "readonly", (s) => s.get(userId))) ?? null;
}

export async function deleteDraft(userId: string): Promise<void> {
  await run(DRAFTS, "readwrite", (s) => s.delete(userId));
}

// ---------------------------------------------------------------------------
// Today's duty, remembered so New Report still opens without signal
// ---------------------------------------------------------------------------

const dutyKey = (userId: string) => `redaid.offline.duty.${userId}`;

export function putDutySnapshot(snapshot: DutySnapshot): void {
  try {
    localStorage.setItem(dutyKey(snapshot.userId), JSON.stringify(snapshot));
  } catch {
    // Storage full or blocked: offline New Report just won't be available.
  }
}

export function getDutySnapshot(userId: string): DutySnapshot | null {
  try {
    const raw = localStorage.getItem(dutyKey(userId));
    return raw ? (JSON.parse(raw) as DutySnapshot) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

/**
 * Asks the browser not to clear RedAid's storage when the phone is low on
 * space. Chrome/Android usually agree for an installed or often-used app;
 * iPhone mostly keeps data for apps added to the Home Screen. Never throws.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.();
    }
  } catch {
    // Not supported: nothing to do.
  }
}
