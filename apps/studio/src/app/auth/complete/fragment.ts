export type AuthFragment =
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

/** Reads what Supabase puts after "#" when a sign-in link is opened. Pure, so it is tested. */
export function readAuthFragment(hash: string): AuthFragment {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const error = params.get("error_code") ?? params.get("error");
  if (error) {
    const expired = error === "otp_expired" || /expired/i.test(params.get("error_description") ?? "");
    return { kind: "error", message: expired ? "That sign-in link has expired or was already used. Each link works once." : "Sign-in did not complete. Send yourself a new link." };
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { kind: "session", accessToken, refreshToken } : { kind: "none" };
}
