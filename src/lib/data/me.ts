import { createClient } from "@/lib/supabase";
import { updateMyUserRow } from "@/lib/data/users";

export const MIN_PASSWORD_LENGTH = 8;

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export async function updateMyProfile(fullName: string, photoPath: string | null): Promise<void> {
  const { first_name, last_name } = splitName(fullName);
  await updateMyUserRow({ first_name, last_name, pfp_img_url: photoPath });
}

export async function changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for the new password.`);
  }
  if (newPassword === currentPassword) {
    throw new Error("The new password must be different from the current one.");
  }

  const supabase = createClient();
  const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (checkError) throw new Error("Your current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
