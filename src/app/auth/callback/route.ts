import type { NextRequest } from "next/server";
import { handleEmailLink } from "@/lib/email-link";

/**
 * General email-link landing page. Kept for links in emails sent before
 * /auth/confirm and /auth/reset existed (?flow=signup, ?next=...), and for
 * token_hash links. New emails use the routes below.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const signup = searchParams.get("flow") === "signup" || type === "signup" || type === "email";
  return handleEmailLink(request, { signup });
}
