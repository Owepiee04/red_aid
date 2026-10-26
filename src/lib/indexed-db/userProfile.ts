import type { AppUser } from "@/types/auth";
import { getAvatarUrl } from "@/lib/storage";
import { getDB } from "./db";
import type { CachedUserProfile } from "./types";

async function readPhotoBlob(
  photoPath: string | null,
  previous: CachedUserProfile | undefined
): Promise<Blob | null> {
  if (!photoPath) return null;
  if (previous?.photoPath === photoPath && previous.photoBlob) return previous.photoBlob;

  try {
    const url = await getAvatarUrl(photoPath);
    if (!url) return null;
    const response = await fetch(url);
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}

export async function cacheUserProfile(user: AppUser): Promise<void> {
  const db = await getDB();
  const previous = await db.get("UserProfile", user.id);
  const photoPath = user.photo_url ?? null;
  const photoBlob = await readPhotoBlob(photoPath, previous);

  await db.put("UserProfile", {
    userId: user.id,
    email: user.email,
    fullName: user.full_name ?? null,
    role: user.role,
    dutyRole: user.duty_role ?? null,
    active: user.active ?? true,
    photoPath,
    photoBlob,
    cachedAt: new Date().toISOString(),
  });
}

export async function getCachedUserProfile(userId: string): Promise<CachedUserProfile | null> {
  const db = await getDB();
  return (await db.get("UserProfile", userId)) ?? null;
}

export function cachedProfileToAppUser(profile: CachedUserProfile): AppUser {
  return {
    id: profile.userId,
    email: profile.email,
    full_name: profile.fullName,
    role: profile.role,
    duty_role: profile.dutyRole,
    active: profile.active,
    photo_url: profile.photoPath,
  };
}
