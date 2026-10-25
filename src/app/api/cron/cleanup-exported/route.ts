import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Daily job (see vercel.json): permanently deletes the patient data of events
// exported more than 7 days ago, including their signature image files.
//
//   1. public.purge_exported_events() deletes the patients (and their reports,
//      vitals and notes), hides the event, logs it, and returns the signature
//      file paths.
//   2. This route deletes those files from the private "signatures" bucket
//      (deleting rows in SQL doesn't remove the actual files).
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". Anyone else is
// refused, so nobody can trigger deletions by visiting the address.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is missing." }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await admin.rpc("purge_exported_events");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { purged_event_id: string; signature_path: string | null }[];
  const events = new Set(rows.map((r) => r.purged_event_id));
  const paths = rows.map((r) => r.signature_path).filter((p): p is string => !!p && !/^https?:/i.test(p));

  let filesDeleted = 0;
  const fileErrors: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data: removed, error: removeError } = await admin.storage.from("signatures").remove(batch);
    if (removeError) fileErrors.push(removeError.message);
    else filesDeleted += removed?.length ?? 0;
  }

  return NextResponse.json({
    eventsCleaned: events.size,
    signatureFilesDeleted: filesDeleted,
    ...(fileErrors.length ? { fileErrors } : {}),
  });
}
