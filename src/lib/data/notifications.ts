import { createClient } from "@/lib/supabase";
import type { Notification, NotificationType } from "@/types/domain";

export type { Notification, NotificationType };

/** A notification plus the event name, for the bell. */
export interface NotificationItem extends Notification {
  event: { name: string } | null;
}

/** Newest first, with the event name. Used by the notification bell. */
export async function listMyNotificationItems(limit = 30): Promise<NotificationItem[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*, event:events!notifications_event_id_fkey(name)")
    .eq("receiver_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NotificationItem[];
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


export async function deleteNotification(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
