"use client";

import { useCallback, useEffect, useState } from "react";
import { OFFLINE_MODE_ENABLED, SYNC_RETRY_MS } from "./config";
import { listQueued, onOutboxChange, syncQueued } from "./outbox";
import { useOnline } from "./network";
import type { QueuedReport } from "./types";

interface UseOutboxOptions {
  /**
   * Send saved reports automatically: now, when the phone gets signal back,
   * when the app comes back to the front, and every SYNC_RETRY_MS while any
   * are waiting. Mount ONE component with this on (OfflineBanner does).
   */
  autoSync?: boolean;
}

/** The signed-in person's saved (not yet sent) reports, kept up to date. */
export function useOutbox(userId: string | null | undefined, { autoSync = false }: UseOutboxOptions = {}) {
  const online = useOnline();
  const [items, setItems] = useState<QueuedReport[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setItems(userId ? await listQueued(userId) : []);
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      await syncQueued(userId);
    } finally {
      setSyncing(false);
      void refresh();
    }
  }, [userId, refresh]);

  useEffect(() => {
    if (!OFFLINE_MODE_ENABLED) return;
    void refresh();
    return onOutboxChange(() => void refresh());
  }, [refresh]);

  const hasItems = items.length > 0;

  useEffect(() => {
    if (!OFFLINE_MODE_ENABLED || !autoSync || !userId || !online) return;
    void syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = hasItems ? window.setInterval(() => void syncNow(), SYNC_RETRY_MS) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) window.clearInterval(timer);
    };
    // `online` flipping to true is the "signal is back" trigger.
  }, [autoSync, userId, online, hasItems, syncNow]);

  return {
    items,
    waiting: items.filter((i) => i.status === "waiting"),
    needsAttention: items.filter((i) => i.status === "needs_attention"),
    online,
    syncing,
    syncNow,
    refresh,
  };
}
