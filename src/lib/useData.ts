"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

interface UseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the fetcher (e.g. after a save). Keeps current data on screen. */
  load: () => Promise<void>;
}

/**
 * Runs `fetcher` on mount and whenever `deps` change.
 * - Ignores out-of-order responses (typing in a search box fires many requests).
 * - Keeps the previous data while reloading, so lists don't flash empty.
 * - Fetchers should throw on failure; the message ends up in `error`.
 */
export function useData<T>(fetcher: () => Promise<T>, deps: DependencyList): UseDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, load };
}
