import { BrandKit } from "@mmos/contracts";
import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";

export type BrandChoice = { slug: string; name: string };

export type BrandData = {
  brands: BrandChoice[];
  current: BrandChoice;
  /** ready: a valid kit; missing: nothing written yet; invalid: stored but fails the contract. */
  state: { kind: "ready"; kit: BrandKit } | { kind: "missing" } | { kind: "invalid"; problems: number };
};

/** One brand's kit: its story, fonts, colours, motion and never-do list. */
export async function getBrand(brandSlug?: string): Promise<BrandData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select("slug, name, brand_kit")
    .eq("workspace_id", shell.workspace.id)
    .order("created_at");
  if (error) throw new Error(`Brands could not load: ${error.message}`);
  if (!data || data.length === 0) return null;

  const written = data.find((b) => hasKit(b.brand_kit));
  const chosen = data.find((b) => b.slug === brandSlug) ?? written ?? data[0]!;
  const brands = data.map(({ slug, name }) => ({ slug, name }));
  const current = { slug: chosen.slug, name: chosen.name };

  if (!hasKit(chosen.brand_kit)) return { brands, current, state: { kind: "missing" } };
  const parsed = BrandKit.safeParse(chosen.brand_kit);
  if (!parsed.success) return { brands, current, state: { kind: "invalid", problems: parsed.error.issues.length } };
  return { brands, current, state: { kind: "ready", kit: parsed.data } };
}

/** An empty object is the column's default, which means nobody has written a kit yet. */
function hasKit(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}
