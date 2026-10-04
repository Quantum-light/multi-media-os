import Link from "next/link";
import { getShows } from "@/lib/data";
import styles from "./shows.module.css";

export const metadata = { title: "Brands and shows · multi-media os" };

export default async function ShowsPage() {
  const data = await getShows();
  if (!data) return null;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Your studio</span>
        <h1 className="display">Brands and <em>shows</em></h1>
        <p className="lead">Each brand holds its own style. Each show has its own look, rhythm and channels, and one account can carry several shows.</p>
      </header>

      {data.brands.length === 0 ? <p className="lead">No brands yet.</p> : null}

      {data.brands.map((brand) => (
        <section key={brand.slug} aria-labelledby={`brand-${brand.slug}`} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="section-head" style={{ flexWrap: "wrap", gap: 12 }}>
            <h2 id={`brand-${brand.slug}`} className="heading">{brand.name}</h2>
            {brand.fonts ? <span className="quiet">Set in {brand.fonts}</span> : null}
          </div>
          {brand.story || brand.styleWords.length > 0 ? (
            <p style={{ margin: 0, maxWidth: 680 }}>
              {brand.story}
              {brand.styleWords.length > 0 ? <span className="quiet"> {brand.styleWords.join(" · ")}</span> : null}
            </p>
          ) : null}

          <div className={styles.grid}>
            {brand.shows.map((show) => (
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
              </article>
            ))}
            {brand.shows.length === 0 ? <p className="quiet">No shows under this brand yet.</p> : null}
          </div>
        </section>
      ))}

      <section aria-labelledby="channels">
        <div className="section-head">
          <h2 id="channels" className="heading">Channels</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(data.channels.length).padStart(2, "0")}</span>
        </div>
        {data.channels.length === 0 ? <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>No channels connected yet.</p> : null}
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
