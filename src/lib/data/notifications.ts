import { createClient } from "@/lib/supabase";
import type { Notification, NotificationType } from "@/types/domain";

export type { Notification, NotificationType };

export interface CreateNotificationInput {
  receiver_id: string;
  type: NotificationType;
  event_id?: string | null;
  vital_signs_id?: string | null;
  note_id?: string | null;
  patient_report_id?: string | null;
  sender_id?: string;
}

export async function listMyNotifications(limit = 100): Promise<Notification[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("receiver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Notification[];
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("has_been_read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ has_been_read: true })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Couldn't update the notification — you may not have permission.");
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ has_been_read: true })
    .eq("receiver_id", user.id)
    .eq("has_been_read", false);
  if (error) throw new Error(error.message);
}

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Please log in again.");

  const { data, error } = await supabase.rpc("create_notification", {
    p_receiver_id: input.receiver_id,
    p_sender_id: input.sender_id ?? user.id,
    p_type: input.type,
    p_event_id: input.event_id ?? null,
    p_vital_signs_id: input.vital_signs_id ?? null,
    p_note_id: input.note_id ?? null,
    p_patient_report_id: input.patient_report_id ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteNotification(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
