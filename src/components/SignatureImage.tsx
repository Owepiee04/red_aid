"use client";

import { useEffect, useState } from "react";
import { getSignatureUrl } from "@/lib/storage";

interface SignatureImageProps {
  /** Storage path saved in reports.signature_url, e.g. "<user id>/<report id>.png". */
  path: string | null | undefined;
}

/**
 * Signatures live in a private bucket, so we ask Supabase for a short-lived
 * link each time a report is opened.
 */
export default function SignatureImage({ path }: SignatureImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setState("loading");
    getSignatureUrl(path).then((signed) => {
      if (cancelled) return;
      setUrl(signed);
      setState(signed ? "ready" : "failed");
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return <p className="text-sm text-muted-foreground">No signature on file.</p>;
  }
  if (state === "failed") {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t load the signature.</p>;
  }
  if (state === "loading" || !url) {
    return <div className="h-32 w-full max-w-xs animate-pulse rounded-xl bg-muted" />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image can't cache it
  return <img src={url} alt="Patient report signature" className="h-32 rounded-xl border border-border bg-white object-contain" />;
}
