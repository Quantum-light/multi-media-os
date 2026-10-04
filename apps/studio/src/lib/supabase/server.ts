import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@mmos/db";
import { MISSING_ENV, supabaseEnv } from "./env";

/** A Supabase client acting as the signed-in person. Row-level security does the rest. */
export async function createClient() {
  const env = supabaseEnv();
  if (!env) throw new Error(MISSING_ENV);
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

export type StudioClient = Awaited<ReturnType<typeof createClient>>;
