import type { NextRequest } from "next/server";
import { handleEmailLink } from "@/lib/email-link";

/** Link in the "Confirm your email" message: confirms the account, then opens /login?confirmed=1. */
export async function GET(request: NextRequest) {
  return handleEmailLink(request, { signup: true });
}
