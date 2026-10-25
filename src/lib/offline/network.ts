"use client";

import { useSyncExternalStore } from "react";
import { NetworkError } from "@/lib/data/reports";

/**
 * True when an error means "couldn't reach the server" (no signal, airplane
 * mode, DNS failure) rather than "the server said no". Browsers word it
 * differently: Chrome "Failed to fetch", Safari "Load failed", Firefox
 * "NetworkError when attempting to fetch resource".
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error ?? "");
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed|err_internet_disconnected|the internet connection appears to be offline/i.test(
    message
  );
}

/** navigator.onLine, but false only when the phone is sure it has no connection. */
export const isOffline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Re-renders when the phone goes online/offline. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );
}
