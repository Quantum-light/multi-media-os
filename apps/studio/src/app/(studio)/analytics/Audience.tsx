import type { AudienceBlock, PublishedRow } from "@/lib/data/analytics.build";
import styles from "./analytics.module.css";

/** Who one show is written for, against who is actually watching. */
export function Audience({ block }: { block: AudienceBlock }) {
  return (
    <section aria-labelledby={`audience-${block.slug}`} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="section-head">
        <h2 id={`audience-${block.slug}`} className="heading">{block.name}</h2>
        <span className="quiet">{block.brand}</span>
      </div>

      <div className={styles.split}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="label">Who it is for</span>
          {block.personas.length === 0 ? (
            <p className="lead">No personas written for {block.brand} yet. Each one needs a name, a description and the comments or messages it came from.</p>
          ) : (
            <ul className={styles.personas}>
              {block.personas.map((p) => (
                <li key={p.name} className={`${styles.persona} glass`}>
                  <span className={styles.personaName}>{p.name}</span>
                  <span style={{ fontSize: 14 }}>{p.description}</span>
                  {p.evidence.length === 0 ? (
                    <span className="quiet">No evidence recorded, so this one is still a guess.</span>
                  ) : (
                    <ul className={styles.evidence}>
                      {p.evidence.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span className="label">Who is watching</span>
          <p className="lead">
            Unknown. No platform analytics are connected, so nothing here can say who is actually watching. There is no chart
            because there is nothing to draw: the moment a platform starts reporting, the real audience appears beside the
            personas above and the two can be compared.
          </p>
        </div>
      </div>
    </section>
  );
}

const STATUS: Record<string, string> = {
  draft: "Draft",
  waiting_review: "Waiting for you",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Stopped",
};

/** Everything that has gone out, or the plain fact that nothing has. */
export function Published({ rows }: { rows: PublishedRow[] }) {
  if (rows.length === 0) {
    return <p className="lead">Nothing has been published yet. Once a post goes out it appears here with its show, its platform and a link to the live piece.</p>;
  }
  return (
    <div className={styles.table}>
      <span className={styles.th}>Show</span>
      <span className={styles.th}>Platform</span>
      <span className={styles.th}>When</span>
      <span className={styles.th}>Status</span>
      {rows.map((r) => (
        <Row key={`${r.show}-${r.platform}-${r.scheduledFor}`} row={r} />
      ))}
    </div>
  );
}

function Row({ row }: { row: PublishedRow }) {
  return (
    <>
      <span className={styles.td}>{row.show}</span>
      <span className={styles.td}>
        {row.liveUrl === null ? row.platform : <a href={row.liveUrl} className="link-gold" rel="noreferrer">{row.platform}</a>}
      </span>
      <span className={`figure ${styles.td}`}>{when(row.scheduledFor)}</span>
      <span className={styles.td}>{STATUS[row.status] ?? row.status}</span>
    </>
  );
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
