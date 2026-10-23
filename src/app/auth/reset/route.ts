import type { NextRequest } from "next/server";
import { handleEmailLink } from "@/lib/email-link";

/** Link in the "Reset your password" message: signs the person in, then opens /reset-password. */
export async function GET(request: NextRequest) {
  return handleEmailLink(request, { next: "/reset-password" });
}
