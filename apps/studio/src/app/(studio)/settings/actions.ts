"use server";

import { revalidatePath } from "next/cache";
import { getShell } from "@/lib/data";
import { getInvitedEmails } from "@/lib/data/settings";
import { checkInvite, isRole } from "@/lib/data/settings.build";
import type { SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

const DUPLICATE = "23505";

/**
 * Writes an invite row with a role. Sending the email itself is not built yet,
 * so the screen says plainly that the invite waits here until it is.
 */
export async function inviteSomeone(email: unknown, role: unknown): Promise<SaveResult> {
  const typed = typeof email === "string" && typeof role === "string";
  if (!typed) return invalid(["The email address and the role both need to be words."]);

  const problems = checkInvite(email, role, await getInvitedEmails());
  if (problems.length > 0) return invalid(problems);
  if (!isRole(role)) return invalid([`"${role}" is not a role.`]);

  const ws = await workspaceId();
  if (ws === null) return noWorkspace();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .insert({ workspace_id: ws, email: email.trim().toLowerCase(), role })
    .select("id");

  if (error) {
    if (error.code === DUPLICATE) return { ok: false, message: `${email.trim().toLowerCase()} has already been invited.`, problems: [] };
    return { ok: false, message: `The invite could not be saved: ${error.message}`, problems: [] };
  }
  if (!data || data.length === 0) return notAllowed("invite people into this workspace");

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Takes back an invite nobody has accepted. An accepted one stays, because
 * removing a person who is already in is a different thing.
 */
export async function revokeInvite(id: unknown): Promise<SaveResult> {
  if (typeof id !== "string" || id === "") return invalid(["That invite could not be identified."]);

  const ws = await workspaceId();
  if (ws === null) return noWorkspace();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .delete()
    .eq("workspace_id", ws)
    .eq("id", id)
    .is("accepted_at", null)
    .select("id");

  if (error) return { ok: false, message: `The invite could not be taken back: ${error.message}`, problems: [] };
  if (!data || data.length === 0) {
    return { ok: false, message: "That invite was not taken back. It may have been accepted already, or you may not be allowed to change it.", problems: [] };
  }

  revalidatePath("/settings");
  return { ok: true };
}

async function workspaceId(): Promise<string | null> {
  const shell = await getShell();
  return shell.workspace ? shell.workspace.id : null;
}

function noWorkspace(): SaveResult {
  return { ok: false, message: "You are not in a workspace yet.", problems: [] };
}

function notAllowed(what: string): SaveResult {
  return { ok: false, message: `You are not allowed to ${what}.`, problems: [] };
}

function invalid(problems: string[]): SaveResult {
  return { ok: false, message: "Nearly there. These parts still need you:", problems };
}
