import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/format";

export type Shell = {
  userEmail: string;
  firstName: string | null;
  workspace: { id: string; name: string; mark: string; brands: number; shows: number } | null;
  /** The workspace's home time zone, read from its first show's posting slots. */
  timeZone: string;
};

type Slot = { tz?: unknown };

/** Who is signed in and which workspace they are in. Cached per request, so layout and page share it. */
export const getShell = cache(async (): Promise<Shell> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("getShell called without a signed-in user (the middleware should have redirected).");

  const fullName = typeof user.user_metadata?.["full_name"] === "string" ? (user.user_metadata["full_name"] as string) : null;
  const base = { userEmail: user.email ?? "", firstName: fullName?.split(" ")[0] ?? null };

  const { data: membership } = await supabase
    .from("members")
    .select("workspace_id, workspaces(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const ws = membership?.workspaces;
  if (!ws) return { ...base, workspace: null, timeZone: "UTC" };

  const [brands, shows] = await Promise.all([
    supabase.from("brands").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
    supabase.from("shows").select("slots").eq("workspace_id", ws.id).order("created_at", { ascending: true }),
  ]);

  return {
    ...base,
    workspace: { id: ws.id, name: ws.name, mark: initials(ws.name), brands: brands.count ?? 0, shows: shows.data?.length ?? 0 },
    timeZone: firstTimeZone(shows.data ?? []),
  };
});

function firstTimeZone(shows: { slots: unknown }[]): string {
  for (const show of shows) {
    if (!Array.isArray(show.slots)) continue;
    for (const slot of show.slots as Slot[]) {
      if (typeof slot?.tz === "string" && isTimeZone(slot.tz)) return slot.tz;
    }
  }
  return "UTC";
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
