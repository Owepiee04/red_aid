"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, ClipboardList, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/formatting";
import type { Role } from "@/lib/roles";
import {
  listMyNotificationItems,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/data/notifications";

const REFRESH_MS = 60_000;

/** What a notification says, its icon, and where tapping it goes. */
function describe(n: NotificationItem, role: Role) {
  const who = n.sender_name || "Someone";
  const event = n.event?.name ?? null;
  switch (n.type) {
    case "Report Pending":
      return {
        icon: ClipboardList,
        title: `${who} submitted a patient report`,
        detail: event ? `${event} · waiting for your review` : "Waiting for your review",
        href: n.patient_report_id
          ? role === "admin"
            ? `/admin/reports/${n.patient_report_id}`
            : `/team-leader/reports/${n.patient_report_id}`
          : null,
      };
    case "Verified":
      return {
        icon: ShieldCheck,
        title: event ? `You're verified for ${event}` : "You're verified for duty",
        detail: `${who} approved you. You can start charting.`,
        href: role === "charter" ? "/charter" : null,
      };
    case "Note":
    default:
      return {
        icon: MessageSquareText,
        title: `${who} reviewed your report and left a note`,
        detail: event ?? "Tap to read it",
        href: n.patient_report_id && role === "charter" ? `/charter/reports/${n.patient_report_id}` : null,
      };
  }
}

interface NotificationBellProps {
  role: Role;
  /** Where the bell sits, which decides where the list opens. */
  placement: "sidebar" | "topbar";
}

/**
 * Bell with an unread count. Opens a list of recent notifications; tapping one
 * marks it read and opens the related report or duty. Refreshes when the app is
 * opened or brought back to the front, and every minute while it's visible.
 */
export default function NotificationBell({ role, placement }: NotificationBellProps) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listMyNotificationItems());
    } catch {
      // Keep showing the last list; the bell must never break the page.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = window.setInterval(refreshIfVisible, REFRESH_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  // Close on Escape, and put focus back on the bell.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = items?.filter((n) => !n.has_been_read).length ?? 0;

  const openItem = async (n: NotificationItem) => {
    const { href } = describe(n, role);
    if (!n.has_been_read) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, has_been_read: true } : x)) ?? prev);
      markNotificationRead(n.id).catch(() => load());
    }
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  const markAll = async () => {
    setItems((prev) => prev?.map((x) => ({ ...x, has_been_read: true })) ?? prev);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground"
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-card">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click anywhere outside to close. */}
          <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Notifications"
            className={cn(
              "fixed z-50 flex max-h-[min(32rem,calc(100vh-6rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl outline-none",
              placement === "topbar" ? "inset-x-3 top-16" : "left-[16.5rem] top-4 w-96"
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="font-heading text-sm font-semibold">Notifications</p>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" />}
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all as read
                </button>
              )}
            </div>

            <div className="overflow-y-auto">
              {items === null ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <BellOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-medium">You&apos;re all caught up</p>
                  <p className="text-xs text-muted-foreground">
                    {role === "charter"
                      ? "You'll see it here when you're verified or a Team Leader reviews your report."
                      : "You'll see it here when a charter submits a report."}
                  </p>
                </div>
              ) : (
                <ul>
                  {items.map((n) => {
                    const { icon: Icon, title, detail, href } = describe(n, role);
                    return (
                      <li key={n.id} className="border-b border-border/60 last:border-0">
                        <button
                          type="button"
                          onClick={() => openItem(n)}
                          className={cn(
                            "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                            !n.has_been_read && "bg-primary/[0.04]",
                            !href && "cursor-default"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              n.has_been_read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                            )}
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-sm leading-snug", !n.has_been_read && "font-semibold")}>
                              {title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
                            <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                          </span>
                          {!n.has_been_read && (
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
