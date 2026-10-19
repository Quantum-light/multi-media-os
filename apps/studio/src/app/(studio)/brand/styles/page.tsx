import Link from "next/link";
import { getStyles, type StyleCard } from "@/lib/data";
import { ArchiveButton } from "./ArchiveButton";
import { StyleEditor } from "./StyleEditor";
import board from "./board.module.css";

export const metadata = { title: "Style Studio · multi-media os" };

type Props = { searchParams: Promise<{ style?: string; new?: string; brand?: string }> };

const KIND: Record<string, string> = { video: "Video", image: "Image", motion: "Motion", voice: "Voice" };

export default async function StylesPage({ searchParams }: Props) {
  const { style, new: isNew, brand } = await searchParams;
  const data = await getStyles();
  if (!data) return null;

  const brands = data.brands.map(({ slug, name }) => ({ slug, name }));

  if (isNew === "1") {
    return <StyleEditor card={null} brands={brands} brandSlug={brand ?? ""} />;
  }

  if (style !== undefined) {
    const card = data.styles.find((s) => s.slug === style);
    if (card) return <StyleEditor card={card} brands={brands} brandSlug={card.brandSlug ?? ""} />;
  }

  const live = data.styles.filter((s) => !s.archived);
  const retired = data.styles.filter((s) => s.archived);

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <span className="eyebrow">Style Studio</span>
          <h1 className="display">Saved <em>styles</em></h1>
          <p className="lead">Named instructions you reuse: how you open an episode, how a short should look, how a title moves. Saved once, then applied by name wherever you work.</p>
        </header>
        <Link href="/brand/styles?new=1" className="btn-gold">Save a style</Link>
      </div>

      {data.styles.length === 0 ? (
        <p className="lead">Nothing saved yet. The first one is usually how you open an episode.</p>
      ) : null}

      {live.length > 0 ? (
        <section aria-labelledby="live" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="section-head">
            <h2 id="live" className="heading">In use</h2>
            <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(live.length).padStart(2, "0")}</span>
          </div>
          <div className={board.grid}>
            {live.map((card) => <Card key={card.id} card={card} />)}
          </div>
        </section>
      ) : null}

      {retired.length > 0 ? (
        <section aria-labelledby="retired" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="section-head">
            <h2 id="retired" className="heading">Retired</h2>
            <span className="quiet">Kept, so old episodes still make sense</span>
          </div>
          <div className={board.grid}>
            {retired.map((card) => <Card key={card.id} card={card} />)}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Card({ card }: { card: StyleCard }) {
  const palette = card.recipe?.palette ?? [];
  const useWhen = card.recipe?.useWhen ?? "";

  return (
    <article className={`${board.card} glass`}>
      <div className={board.head}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <h3 className={board.name}>{card.name}</h3>
          <span className="label">{KIND[card.kind] ?? card.kind} · {card.brandSlug ?? "every brand"}</span>
        </div>
        {palette.length > 0 ? (
          <span className={board.swatches} aria-hidden="true">
            {palette.map((colour) => <span key={colour} style={{ background: colour }} />)}
          </span>
        ) : null}
      </div>

      {useWhen ? <p className={board.useWhen}>{useWhen}</p> : null}
      <p className={board.prompt}>{card.prompt}</p>

      {card.neverDo.length > 0 ? (
        <span className="quiet">Never: {card.neverDo.join(" · ")}</span>
      ) : null}
      {card.recipe === null ? (
        <span className="quiet" style={{ color: "var(--gold-ink)" }}>Its settings are incomplete — open it to finish them.</span>
      ) : null}

      <div className={board.foot}>
        <Link href={`/brand/styles?style=${card.slug}`} className="link-gold">Open</Link>
        <ArchiveButton slug={card.slug} archived={card.archived} />
      </div>
    </article>
  );
}
