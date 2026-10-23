import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";
import { buildSettings, startOfLastMonth, type SettingsData } from "./settings.build";

export type { SettingsData, MemberLine, InviteLine, ChannelLine, StepSpend } from "./settings.build";

/**
 * The workspace, the people in it, what it is connected to, and what it has
 * cost. Reads as the signed-in person, so row-level security decides what
 * comes back; empty tables are real and say so on the screen.
 */
export async function getSettings(): Promise<SettingsData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  const me = { userId: auth.user?.id ?? "", email: auth.user?.email ?? shell.userEmail };

  const now = new Date();
  const since = startOfLastMonth(now, shell.timeZone);

  const [members, invites, channels, links, shows, jobs] = await Promise.all([
    supabase.from("members").select("user_id, role").eq("workspace_id", ws).order("created_at"),
    supabase.from("invites").select("id, email, role, accepted_at, created_at").eq("workspace_id", ws).order("created_at", { ascending: false }),
    supabase.from("channels").select("id, platform, handle, status").eq("workspace_id", ws).order("platform"),
    supabase.from("show_channels").select("show_id, channel_id").eq("workspace_id", ws),
    supabase.from("shows").select("id, name").eq("workspace_id", ws).order("created_at"),
    supabase.from("jobs").select("step, cost_pence, created_at").eq("workspace_id", ws).gte("created_at", since.toISOString()),
  ]);

  const error = members.error ?? invites.error ?? channels.error ?? links.error ?? shows.error ?? jobs.error;
  if (error) throw new Error(`Settings could not load: ${error.message}`);

  return buildSettings(
    {
      workspace: { name: shell.workspace.name, brands: shell.workspace.brands, shows: shell.workspace.shows },
      members: members.data ?? [],
      invites: invites.data ?? [],
      channels: channels.data ?? [],
      links: links.data ?? [],
      shows: shows.data ?? [],
      jobs: jobs.data ?? [],
    },
    now,
    shell.timeZone,
    me,
  );
}

/** Email addresses already invited, so the same person is not asked twice. */
export async function getInvitedEmails(): Promise<string[]> {
  const shell = await getShell();
  if (!shell.workspace) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("invites").select("email").eq("workspace_id", shell.workspace.id);
  return (data ?? []).map((row) => row.email);
}
