"use server";

import { revalidatePath } from "next/cache";
import { BrandSettings, ChannelSettings, ShowSettings } from "@mmos/contracts";
import { getShell } from "@/lib/data";
import { problemsFrom, type SaveResult } from "@/lib/save";
import { createClient } from "@/lib/supabase/server";

const FIELDS: Record<string, string> = {
  name: "The name",
  slug: "The short name",
  brandSlug: "The brand",
  kind: "What kind of show",
  approvalMode: "How approval works",
  ground: "Background colour",
  accent: "Accent colour",
  ink: "Text colour",
  theme: "The show's colours",
  day: "Day",
  time: "Time",
  tz: "Time zone",
  slots: "When it goes out",
  platform: "The platform",
  handle: "The handle",
  channelIds: "Channels",
};

const DUPLICATE = "23505";

type Client = Awaited<ReturnType<typeof createClient>>;

/** A new brand starts with an empty kit; Brand and style is where it gets written. */
export async function saveBrand(previousSlug: string | null, draft: unknown): Promise<SaveResult> {
  const parsed = BrandSettings.safeParse(draft);
  if (!parsed.success) return invalid(problemsFrom(parsed.error.issues, FIELDS));

  const ws = await workspaceId();
  if (ws === null) return noWorkspace();
  const supabase = await createClient();

  const written =
    previousSlug === null
      ? await supabase.from("brands").insert({ workspace_id: ws, name: parsed.data.name, slug: parsed.data.slug, brand_kit: {} }).select("slug")
      : await supabase.from("brands").update({ name: parsed.data.name, slug: parsed.data.slug }).eq("workspace_id", ws).eq("slug", previousSlug).select("slug");

  const problem = written.error ? saveProblem(written.error, `brand "${parsed.data.slug}"`) : empty(written.data, "brands");
  if (problem) return problem;

  revalidatePath("/shows");
  revalidatePath("/brand");
  return { ok: true };
}

/** Saves a show and the channels it posts to, in that order. */
export async function saveShow(previousSlug: string | null, draft: unknown): Promise<SaveResult> {
  const parsed = ShowSettings.safeParse(draft);
  if (!parsed.success) return invalid(problemsFrom(parsed.error.issues, FIELDS, ["slots"]));

  const ws = await workspaceId();
  if (ws === null) return noWorkspace();
  const supabase = await createClient();
  const show = parsed.data;

  const { data: brand } = await supabase.from("brands").select("id").eq("workspace_id", ws).eq("slug", show.brandSlug).maybeSingle();
  if (!brand) return { ok: false, message: "Choose a brand for this show first.", problems: [] };

  const row = {
    workspace_id: ws,
    brand_id: brand.id,
    name: show.name,
    slug: show.slug,
    kind: show.kind,
    approval_mode: show.approvalMode,
    theme: show.theme,
    slots: show.slots,
  };

  const written =
    previousSlug === null
      ? await supabase.from("shows").insert(row).select("id")
      : await supabase.from("shows").update(row).eq("workspace_id", ws).eq("slug", previousSlug).select("id");

  const problem = written.error ? saveProblem(written.error, `show "${show.slug}"`) : empty(written.data, "shows");
  if (problem) return problem;

  const showId = written.data?.[0]?.id;
  if (showId !== undefined) {
    const linked = await syncChannels(supabase, ws, showId, show.channelIds);
    if (linked) return linked;
  }

  revalidatePath("/shows");
  revalidatePath("/calendar");
  return { ok: true };
}

export async function saveChannel(draft: unknown): Promise<SaveResult> {
  const parsed = ChannelSettings.safeParse(draft);
  if (!parsed.success) return invalid(problemsFrom(parsed.error.issues, FIELDS));

  const ws = await workspaceId();
  if (ws === null) return noWorkspace();
  const supabase = await createClient();

  const written = await supabase
    .from("channels")
    .insert({ workspace_id: ws, platform: parsed.data.platform, handle: parsed.data.handle, status: parsed.data.status })
    .select("id");

  const problem = written.error ? saveProblem(written.error, `${parsed.data.platform} channel "${parsed.data.handle}"`) : empty(written.data, "channels");
  if (problem) return problem;

  revalidatePath("/shows");
  return { ok: true };
}

/** Adds the links that are missing and removes the ones no longer wanted. */
async function syncChannels(supabase: Client, ws: string, showId: string, wanted: string[]): Promise<SaveResult | null> {
  const { data: existing, error } = await supabase.from("show_channels").select("channel_id").eq("workspace_id", ws).eq("show_id", showId);
  if (error) return { ok: false, message: `The show saved, but its channels did not: ${error.message}`, problems: [] };

  const have = new Set<string>((existing ?? []).map((row) => row.channel_id));
  const add = wanted.filter((id) => !have.has(id));
  const drop = [...have].filter((id) => !wanted.includes(id));

  if (add.length > 0) {
    const { error: addError } = await supabase.from("show_channels").insert(add.map((id) => ({ workspace_id: ws, show_id: showId, channel_id: id })));
    if (addError) return { ok: false, message: `The show saved, but a channel could not be connected: ${addError.message}`, problems: [] };
  }
  if (drop.length > 0) {
    const { error: dropError } = await supabase.from("show_channels").delete().eq("workspace_id", ws).eq("show_id", showId).in("channel_id", drop);
    if (dropError) return { ok: false, message: `The show saved, but a channel could not be disconnected: ${dropError.message}`, problems: [] };
  }
  return null;
}

async function workspaceId(): Promise<string | null> {
  const shell = await getShell();
  return shell.workspace ? shell.workspace.id : null;
}

function noWorkspace(): SaveResult {
  return { ok: false, message: "You are not in a workspace yet.", problems: [] };
}

function invalid(problems: string[]): SaveResult {
  return { ok: false, message: "Nearly there. These parts still need you:", problems };
}

function saveProblem(error: { code: string; message: string }, what: string): SaveResult {
  if (error.code === DUPLICATE) return { ok: false, message: `There is already a ${what} in this workspace.`, problems: [] };
  return { ok: false, message: `It could not be saved: ${error.message}`, problems: [] };
}

function empty(data: unknown[] | null, table: string): SaveResult | null {
  if (data && data.length > 0) return null;
  return { ok: false, message: `You do not have permission to change ${table} in this workspace.`, problems: [] };
}
