import { getConstellation } from "@/lib/data";
import { plural } from "@/lib/format";
import { HoldForm } from "./HoldForm";
import styles from "./constellation.module.css";

export const metadata = { title: "Constellation · multi-media os" };

export default async function ConstellationPage() {
  const data = await getConstellation();
  if (!data) return null;
  const { counts, themes, otherLinks, moments, held } = data;
  const ahead = moments.filter((m) => !m.past);

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
        <span className="eyebrow">Constellation</span>
        <h1 className="display">Content through <em>time</em></h1>
        <p className="lead">
          The themes your work keeps returning to, what connects to what, and the moments in the year worth planning around. Put a piece on hold for one of them and it waits here until that moment comes near.
        </p>
      </header>

      <dl className={styles.counts}>
        <Count label="Themes" value={counts.themes} />
        <Count label="Connections" value={counts.links} />
        <Count label="Moments ahead" value={counts.moments} />
        <Count label="Being held" value={counts.held} />
      </dl>

      <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="section-head">
          <h2 className="heading">Themes</h2>
          <span className="label">{plural(counts.themes, "theme")}</span>
        </div>
        {themes.length === 0 ? (
          <p className="lead">No themes yet. As each recording is read, the themes it belongs to appear here, with what they connect to.</p>
        ) : (
          <div className={styles.themes}>
            {themes.map((theme) => (
              <article key={theme.id} className={`${styles.theme} glass`}>
                <h3 className={styles.themeName}>{theme.name}</h3>
                <span className="label">{plural(theme.linkCount, "connection")}</span>
                {theme.links.length === 0 ? (
                  <span className="quiet">Nothing connected to it yet.</span>
                ) : (
                  <ul className={styles.links}>
                    {theme.links.slice(0, 6).map((link) => (
                      <li key={link.id} className={styles.link}>
                        <span className={styles.relation}>{link.relation}</span>
                        <span>{link.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {theme.links.length > 6 ? <span className="quiet">and {plural(theme.links.length - 6, "more connection")}</span> : null}
              </article>
            ))}
          </div>
        )}
        {otherLinks.length > 0 ? (
          <ul className={styles.links}>
            {otherLinks.slice(0, 12).map((link) => (
              <li key={link.id} className={styles.link}>
                <span>{link.from}</span>
                <span className={styles.relation}>{link.relation}</span>
                <span>{link.to}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="section-head">
          <h2 className="heading">Moments in time</h2>
          <span className="label">{plural(counts.moments, "moment")} ahead</span>
        </div>
        {moments.length === 0 ? (
          <p className="lead">No moments in time yet.</p>
        ) : (
          <ul className={styles.moments}>
            {moments.map((moment) => (
              <li key={moment.id} className={moment.past ? `${styles.moment} ${styles.passed}` : styles.moment}>
                <span className={styles.when}>
                  <span className="figure">{moment.whenLabel}</span>
                  <span className="quiet">{moment.relative}</span>
                </span>
                <span className={styles.body}>
                  <span className={styles.momentName}>{moment.name}</span>
                  {moment.held.length === 0 ? (
                    <span className="quiet">Nothing held for it yet.</span>
                  ) : (
                    <span className={styles.heldList}>
                      {moment.held.map((piece) => (
                        <span key={piece.id} className={styles.heldPiece}>
                          {piece.label}
                          {piece.source ? <span className="quiet"> — {piece.source}</span> : null}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="chip">{moment.scope === "global" ? "In the world" : "Yours"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="section-head">
          <h2 className="heading">Hold something for later</h2>
          <span className="label">{plural(counts.held, "piece")} held</span>
        </div>
        {data.holdable.length === 0 || ahead.length === 0 ? (
          <p className="lead">
            {data.holdable.length === 0
              ? "Nothing to hold yet. Upload a recording, and the pieces made from it can wait here for the right moment."
              : "No moment ahead to hold anything for yet."}
          </p>
        ) : (
          <div className="columns">
            <HoldForm pieces={data.holdable} moments={ahead.map((m) => ({ value: m.id, label: `${m.name} · ${m.whenLabel}` }))} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="label">Being held</span>
              {held.length === 0 ? (
                <span className="quiet">Nothing is being held yet.</span>
              ) : (
                held.map((piece) => (
                  <span key={piece.id} className={styles.heldRow}>
                    <span>{piece.label}</span>
                    <span className="quiet">for {piece.anchorName} · {piece.whenLabel}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.count}>
      <dt className="label">{label}</dt>
      <dd className={`figure ${styles.countValue}`}>{value}</dd>
    </div>
  );
}
