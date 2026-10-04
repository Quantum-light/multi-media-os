import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/format";

const OTP_TYPES: ReadonlySet<string> = new Set(["magiclink", "email", "signup", "invite", "recovery", "email_change"]);

/** Where the magic link lands. Swaps the one-time code for a session cookie. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  // Links sent with the implicit flow carry the session in the URL fragment, which never
  // reaches the server. Browsers keep the fragment across redirects, so the complete page reads it.
  if (!code && !tokenHash) {
    const to = new URL("/auth/complete", url.origin);
    if (next !== "/") to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash })).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/login?error=link", url.origin));
}
