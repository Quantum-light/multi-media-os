"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/format";

export type LinkState = { status: "idle" | "sent" | "error"; message: string };

const Email = z.string().trim().toLowerCase().email();

/** Sends a one-time sign-in link. No passwords anywhere in the Studio. */
export async function sendLink(_prev: LinkState, form: FormData): Promise<LinkState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { status: "error", message: "That email address does not look right." };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  if (!host) return { status: "error", message: "Could not work out this site's address. Try again." };

  const next = safeNext(String(form.get("next") ?? "/"));
  const redirectTo = `${proto}://${host}/auth/callback${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`;

  const supabase = await createClient({ flowType: "implicit" });
  const { error } = await supabase.auth.signInWithOtp({ email: email.data, options: { emailRedirectTo: redirectTo } });
  if (error) {
    const tooMany = error.status === 429;
    return { status: "error", message: tooMany ? "Too many links sent just now. Wait a few minutes, then try again." : "The link could not be sent. Try again in a moment." };
  }
  return { status: "sent", message: "Check your inbox. The link signs you in on this device." };
}
