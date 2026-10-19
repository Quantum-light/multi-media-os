import { StyleRecipe } from "@mmos/contracts";
import { createClient } from "@/lib/supabase/server";
import { getShell } from "./shell";

export type StyleCard = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  prompt: string;
  neverDo: string[];
  /** Parsed when the stored recipe passes the contract; null when it does not. */
  recipe: StyleRecipe | null;
  brandSlug: string | null;
  archived: boolean;
};

export type StylesData = { styles: StyleCard[]; brands: { id: string; slug: string; name: string }[] };

/** Every saved style in the workspace: live ones first, each most-recently-changed first. */
export async function getStyles(): Promise<StylesData | null> {
  const shell = await getShell();
  if (!shell.workspace) return null;
  const ws = shell.workspace.id;
  const supabase = await createClient();

  const [styles, brands] = await Promise.all([
    supabase
      .from("styles")
      .select("id, slug, name, kind, prompt, never_do, recipe, brand_id, archived_at")
      .eq("workspace_id", ws)
      .order("updated_at", { ascending: false }),
    supabase.from("brands").select("id, slug, name").eq("workspace_id", ws).order("created_at"),
  ]);
  const error = styles.error ?? brands.error;
  if (error) throw new Error(`Styles could not load: ${error.message}`);

  const brandRows = brands.data ?? [];
  const brandSlugById = new Map(brandRows.map((b) => [b.id, b.slug]));

  const cards: StyleCard[] = (styles.data ?? []).map((row) => {
    const parsed = StyleRecipe.safeParse(row.recipe);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      prompt: row.prompt,
      neverDo: row.never_do,
      recipe: parsed.success ? parsed.data : null,
      brandSlug: row.brand_id === null ? null : (brandSlugById.get(row.brand_id) ?? null),
      archived: row.archived_at !== null,
    };
  });

  const live = (card: StyleCard) => (card.archived ? 1 : 0);
  return { styles: [...cards].sort((a, b) => live(a) - live(b)), brands: brandRows };
}
