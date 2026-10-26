"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/formatting";
import { getAvatarUrl } from "@/lib/storage";

interface UserAvatarProps {
  /** Photo location from profiles.photo_url (a storage path, or a full http(s) URL). */
  uri?: string | null;
  /** Offline copy of the profile photo; used instead of fetching a signed URL. */
  blob?: Blob | null;
  name?: string | null;
  className?: string;
  textClassName?: string;
}

/** Profile photo (stored privately) with an initials fallback. */
export default function UserAvatar({
  uri,
  blob,
  name,
  className = "h-10 w-10",
  textClassName = "text-sm",
}: UserAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);

    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => {
        alive = false;
        URL.revokeObjectURL(objectUrl);
      };
    }

    if (!uri) return;
    getAvatarUrl(uri).then((resolved) => {
      if (alive) setUrl(resolved);
    });
    return () => {
      alive = false;
    };
  }, [uri, blob]);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
      <img src={url} alt={name || "Profile photo"} className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading font-semibold text-primary",
        className,
        textClassName
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
