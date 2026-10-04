import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = ["/login", "/auth"];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Keeps the session fresh on every request and sends signed-out visitors to /login. */
export async function middleware(request: NextRequest) {
  const env = supabaseEnv();
  // Without settings the pages explain what is missing; nothing to refresh here.
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser checks the token with Supabase, so a forged cookie never passes.
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // If Supabase sends a sign-in link to the site root (its Site URL) instead of the callback,
  // pass the one-time code on to the callback rather than losing it.
  const code = request.nextUrl.searchParams.get("code");
  if (!data.user && code && !path.startsWith("/auth/")) {
    const to = request.nextUrl.clone();
    to.pathname = "/auth/callback";
    to.search = `?code=${encodeURIComponent(code)}`;
    return NextResponse.redirect(to);
  }
  if (!data.user && path.startsWith("/api/")) {
    return NextResponse.json({ code: "signed_out", message: "Sign in again." }, { status: 401 });
  }
  if (!data.user && !isPublic(path)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    const back = `${path}${request.nextUrl.search}`;
    to.search = back === "/" ? "" : `?next=${encodeURIComponent(back)}`;
    return NextResponse.redirect(to);
  }
  if (data.user && path === "/login") {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"],
};
