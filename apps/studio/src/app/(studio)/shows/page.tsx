import Link from "next/link";
import { getShows, getStudioSetup } from "@/lib/data";
import { BrandForm } from "./BrandForm";
import { ChannelForm } from "./ChannelForm";
import { ShowForm } from "./ShowForm";
import styles from "./shows.module.css";

export const metadata = { title: "Brands and shows · multi-media os" };

type Props = { searchParams: Promise<{ add?: string; brand?: string; editBrand?: string; editShow?: string }> };

export default async function ShowsPage({ searchParams }: Props) {
  const { add, brand, editBrand, editShow } = await searchParams;

  if (add === "channel") return <ChannelForm />;

  if (add === "brand" || editBrand !== undefined) {
    const setup = await getStudioSetup(editBrand === undefined ? {} : { brand: editBrand });
    if (!setup) return null;
    return <BrandForm brand={setup.brand} />;
  }

  if (add === "show" || editShow !== undefined) {
    const asked = editShow === undefined ? {} : { show: editShow };
    const setup = await getStudioSetup(asked);
    if (!setup) return null;
    return (
      <ShowForm
        show={setup.show}
        brands={setup.brands}
        channels={setup.channels}
        brandSlug={brand ?? setup.show?.brandSlug ?? ""}
        timeZone={setup.timeZone}
      />
    );
  }

  const data = await getShows();
  if (!data) return null;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <span className="eyebrow">Your studio</span>
          <h1 className="display">Brands and <em>shows</em></h1>
          <p className="lead">Each brand holds its own style. Each show has its own look, rhythm and channels, and one account can carry several shows.</p>
        </header>
        <Link href="/shows?add=show" className="btn-gold">Add a show</Link>
      </div>

      <nav aria-label="Add" style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: -24 }}>
        <Link href="/shows?add=brand" className="link-gold">Add a brand</Link>
        <Link href="/shows?add=channel" className="link-gold">Add a channel</Link>
      </nav>

      {data.brands.length === 0 ? (
        <p className="lead">No brands yet. A brand comes first: it holds the fonts, colours and voice every show under it inherits.</p>
      ) : null}

      {data.brands.map((brandBlock) => (
        <section key={brandBlock.slug} aria-labelledby={`brand-${brandBlock.slug}`} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="section-head" style={{ flexWrap: "wrap", gap: 12 }}>
            <h2 id={`brand-${brandBlock.slug}`} className="heading">{brandBlock.name}</h2>
            <span style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
              {brandBlock.fonts ? <span className="quiet">Set in {brandBlock.fonts}</span> : null}
              <Link href={`/brand?brand=${brandBlock.slug}`} className="link-gold">Style</Link>
              <Link href={`/shows?editBrand=${brandBlock.slug}`} className="link-gold">Rename</Link>
            </span>
          </div>
          {brandBlock.story || brandBlock.styleWords.length > 0 ? (
            <p style={{ margin: 0, maxWidth: 680 }}>
              {brandBlock.story}
              {brandBlock.styleWords.length > 0 ? <span className="quiet"> {brandBlock.styleWords.join(" · ")}</span> : null}
            </p>
          ) : null}

          <div className={styles.grid}>
            {brandBlock.shows.map((show) => (
              <article key={show.slug} className={`${styles.card} glass`}>
                <div className={styles.cardHead}>
                  <span
                    aria-hidden="true"
                    className={styles.orb}
                    style={show.colours ? { background: `radial-gradient(circle at 35% 30%, ${show.colours.accent} 0%, ${show.colours.ground} 62%)`, boxShadow: `0 0 0 1px ${show.colours.accent}66` } : undefined}
                  />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <h3 className={styles.showName}>{show.name}</h3>
                    <span className="label">{show.kind}</span>
                  </div>
                </div>

                <dl className={styles.facts}>
                  <dt>Rhythm</dt><dd>{show.rhythm}</dd>
                  <dt>Approval</dt><dd>{show.approval}</dd>
                  <dt>Vision</dt>
                  <dd>{show.hasVision ? <Link className="link-gold" href={`/vision?show=${show.slug}`}>Open</Link> : <span className="quiet">Not written yet</span>}</dd>
                </dl>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span className="label">Posts to</span>
                  {show.channels.length === 0 ? (
                    <span className="quiet">No channels connected</span>
                  ) : (
                    show.channels.map((c) => (
                      <span key={c.label} style={{ fontSize: 13 }}>
                        {c.label}
                        {c.carries ? <span className="quiet"> · {c.carries}</span> : null}
                      </span>
                    ))
                  )}
                </div>

                <Link href={`/shows?editShow=${show.slug}`} className="link-gold" style={{ alignSelf: "flex-start" }}>Edit this show</Link>
              </article>
            ))}
            {brandBlock.shows.length === 0 ? (
              <p className="quiet">
                No shows under this brand yet. <Link href={`/shows?add=show&brand=${brandBlock.slug}`} className="link-gold">Add one</Link>.
              </p>
            ) : null}
          </div>
        </section>
      ))}

      <section aria-labelledby="channels">
        <div className="section-head">
          <h2 id="channels" className="heading">Channels</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(data.channels.length).padStart(2, "0")}</span>
        </div>
        {data.channels.length === 0 ? (
          <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>
            No channels yet. <Link href="/shows?add=channel" className="link-gold">Add one</Link>.
          </p>
        ) : null}
        {data.channels.map((c) => (
          <div key={c.id} className="row">
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: c.connected ? "var(--good)" : "var(--gold)" }} />
            <div className="row__body">
              <span className="row__title" style={{ fontSize: 16 }}>{c.label}</span>
              <span className="quiet">
                {c.connected ? "Connected" : "Disconnected"}
                {c.shows.length > 0 ? ` · carries ${c.shows.join(", ")}` : " · not used by any show"}
              </span>
            </div>
            {c.shared ? <span className="chip chip--on">Shared by {c.shows.length} shows</span> : null}
          </div>
        ))}
      </section>
    </>
  );
}
