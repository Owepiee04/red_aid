"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, CloudOff, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { OFFLINE_MODE_ENABLED, useOutbox } from "@/lib/offline";
import type { Role } from "@/lib/roles";

/**
 * The strip at the top of every signed-in page that says when the phone is
 * offline or saved reports are being sent. It is also what sends saved reports
 * automatically (useOutbox autoSync), so AppShell mounts exactly one.
 */
export default function OfflineBanner({ role }: { role: Role }) {
  const { user } = useAuth();
  const { items, needsAttention, online, syncing } = useOutbox(user?.id, { autoSync: true });

  if (!OFFLINE_MODE_ENABLED) return null;

  const n = items.length;
  const reports = (count: number) => `${count} report${count === 1 ? "" : "s"}`;

  if (!online) {
    return (
      <Strip tone="amber" icon={<CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />}>
        <strong className="font-semibold">You&apos;re offline.</strong>{" "}
        {role === "charter"
          ? n > 0
            ? `${reports(n)} saved on this phone. They'll send automatically when you have signal.`
            : "You can still submit reports. They'll be saved on this phone and sent when you have signal."
          : "Some information may be out of date until you're back online."}
      </Strip>
    );
  }

  if (n === 0) return null;

  if (needsAttention.length > 0 && !syncing) {
    return (
      <Strip tone="red" icon={<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}>
        {needsAttention.length === 1 ? "1 saved report couldn't be sent." : `${needsAttention.length} saved reports couldn't be sent.`}{" "}
        {role === "charter" && (
          <Link href="/charter" className="font-semibold underline underline-offset-2">
            See why
          </Link>
        )}
      </Strip>
    );
  }

  return (
    <Strip tone="blue" icon={<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}>
      Sending {reports(n)} saved on this phone…
    </Strip>
  );
}

const TONES = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-red-200 bg-red-50 text-red-900",
  blue: "border-sky-200 bg-sky-50 text-sky-900",
};

function Strip({ tone, icon, children }: { tone: keyof typeof TONES; icon: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${TONES[tone]}`}>
      <span className="mt-0.5">{icon}</span>
      <p className="leading-snug">{children}</p>
    </div>
  );
}
