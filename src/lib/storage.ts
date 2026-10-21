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
