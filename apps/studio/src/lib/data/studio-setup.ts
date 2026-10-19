import { Slot, Theme, type Day } from "@mmos/contracts";
import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";

export type BrandRef = { id: string; slug: string; name: string };
export type ChannelRef = { id: string; platform: string; handle: string; status: string };

export type ShowSetup = {
  id: string;
  brandSlug: string;
  slug: string;
  name: string;
  kind: string;
  approvalMode: string;
  theme: { ground: string; accent: string; ink: string } | null;
  slots: { day: Day; time: string; tz: string }[];
  channelIds: string[];
};

export type StudioSetup = {
  brands: BrandRef[];
  channels: ChannelRef[];
  /** The show being edited, when one was asked for and found. */
  show: ShowSetup | null;
  /** The brand being edited, when one was asked for and found. */
  brand: BrandRef | null;
  /** The workspace's own time zone, offered as the default for a new slot. */
  timeZone: string;
};

/** Everything the set-up forms need: what exists, and the one thing being changed. */
export async function getStudioSetup(asked: { show?: string; brand?: string }): Promise<StudioSetup | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const [brands, channels] = await Promise.all([
    supabase.from("brands").select("id, slug, name").eq("workspace_id", ws).order("created_at"),
    supabase.from("channels").select("id, platform, handle, status").eq("workspace_id", ws).order("platform"),
  ]);
  const listError = brands.error ?? channels.error;
  if (listError) throw new Error(`The studio could not load: ${listError.message}`);

  const brandRows = brands.data ?? [];
  const base = { brands: brandRows, channels: channels.data ?? [], timeZone: shell.timeZone };
  const brand = asked.brand === undefined ? null : brandRows.find((b) => b.slug === asked.brand) ?? null;

  if (asked.show === undefined) return { ...base, show: null, brand };

  const { data: show, error } = await supabase
    .from("shows")
    .select("id, brand_id, slug, name, kind, approval_mode, theme, slots")
    .eq("workspace_id", ws)
    .eq("slug", asked.show)
    .maybeSingle();
  if (error) throw new Error(`That show could not load: ${error.message}`);
  if (!show) return { ...base, show: null, brand };

  const { data: links } = await supabase.from("show_channels").select("channel_id").eq("workspace_id", ws).eq("show_id", show.id);
  const brandSlug = brandRows.find((b) => b.id === show.brand_id)?.slug ?? "";
  const theme = Theme.safeParse(show.theme);
  const slots = Array.isArray(show.slots) ? show.slots.flatMap(readSlot) : [];

  return {
    ...base,
    brand,
    show: {
      id: show.id,
      brandSlug,
      slug: show.slug,
      name: show.name,
      kind: show.kind,
      approvalMode: show.approval_mode,
      theme: theme.success ? theme.data : null,
      slots,
      channelIds: (links ?? []).map((l) => l.channel_id),
    },
  };
}

/** A stored slot that no longer passes the contract is left out rather than guessed at. */
function readSlot(value: unknown): { day: Day; time: string; tz: string }[] {
  const parsed = Slot.safeParse(value);
  return parsed.success ? [parsed.data] : [];
}
