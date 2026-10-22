import { createClient } from "@/lib/supabase";

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Saves the signed-in person's own name and photo through the
 * update_my_profile database function (it can't touch role, duty role
 * or active, so nobody can promote themselves from the Settings page).
 * Pass photoPath = null to remove the photo.
 */
export async function updateMyProfile(fullName: string, photoPath: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: fullName,
    p_photo_url: photoPath,
  });
  if (error) throw new Error(error.message);
}

/**
 * Changes the password after checking the current one, so someone who picks
 * up an unlocked phone can't lock the owner out of their account.
 */
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
