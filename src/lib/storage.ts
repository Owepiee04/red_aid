import { createClient } from "@/lib/supabase";

const BUCKET = "signatures";

/** Turn a canvas `data:image/png;base64,...` string into a Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/png";
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/**
 * Uploads a signature to the private bucket at <userId>/<reportId>.png and
 * returns that storage path (this is what gets saved in reports.signature_url).
 * upsert makes a retry after a failed submit safe.
 */
export async function uploadSignature(userId: string, reportId: string, dataUrl: string): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${reportId}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, dataUrlToBlob(dataUrl), { contentType: "image/png", upsert: true });
  if (error) throw new Error(`Couldn't upload the signature: ${error.message}`);
  return path;
}

/** Short-lived link for showing a stored signature (the bucket is private). */
export async function getSignatureUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  return error ? null : data.signedUrl;
}

// ---------------------------------------------------------------------------
// Profile photos
// ---------------------------------------------------------------------------

const AVATAR_BUCKET = "avatars";
const AVATAR_TTL_SECONDS = 3600;
// A list of 40 accounts shouldn't make 40 requests every time you open it, so
// signed links are remembered in memory until shortly before they expire.
const avatarCache = new Map<string, { url: string; expiresAt: number }>();

/** Turns profiles.photo_url into something an <img> can load, or null if it can't. */
export async function getAvatarUrl(photo: string): Promise<string | null> {
  if (/^https?:\/\//i.test(photo)) return photo; // already a full URL
  const cached = avatarCache.get(photo);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const supabase = createClient();
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(photo, AVATAR_TTL_SECONDS);
  if (error || !data) return null;
  avatarCache.set(photo, { url: data.signedUrl, expiresAt: Date.now() + (AVATAR_TTL_SECONDS - 300) * 1000 });
  return data.signedUrl;
}

const AVATAR_MAX_SIDE = 512;
const AVATAR_MAX_INPUT_BYTES = 15 * 1024 * 1024;

/**
 * Shrinks a picked photo to at most 512px (JPEG) in the browser, so a 6 MB
 * phone picture uploads as ~50-100 KB. Drawing it onto a canvas also turns
 * iPhone HEIC photos (when the browser can open them) into a normal JPEG.
 */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > AVATAR_MAX_INPUT_BYTES) throw new Error("That image is too large (15 MB max).");

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Couldn't read that image. Try a JPG or PNG.");
  });
  const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      0.85
    )
  );
}

/**
 * Uploads a new profile photo to avatars/<userId>/avatar-<time>.jpg and
 * returns that storage path (save it with updateMyProfile). A new file name
 * each time means nobody keeps seeing the old photo from a cached link.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const supabase = createClient();
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`Couldn't upload the photo: ${error.message}`);
  return path;
}
