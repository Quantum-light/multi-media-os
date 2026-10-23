import { searchEverything } from "@/lib/data";
import { plural } from "@/lib/format";
import { Hit } from "./Hit";
import styles from "./map.module.css";

export const metadata = { title: "Map · multi-media os" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function MapPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const data = await searchEverything(q);
  if (!data) return null;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Everything you have said</span>
        <h1 className="display">Map</h1>
        <p className="lead">
          Search a phrase and see every time you said it: which episode, which show, and the sentence around it. This
          searches words, exactly as they were said. Meaning-based search comes once moments carry embeddings.
        </p>
      </header>

      <form action="/map" method="get" className={styles.search} role="search">
        <label className={styles.field}>
          <span className="label">A phrase you said</span>
          <input
            className={styles.input}
            type="search"
            name="q"
            defaultValue={data.query}
            placeholder="quantum light"
            autoComplete="off"
            aria-describedby="map-holding"
          />
        </label>
        <button type="submit" className="btn-gold">Search</button>
      </form>

      <p id="map-holding" className="quiet" style={{ marginTop: -40, marginBottom: 0 }}>
        {holdingLine(data.holding)}
      </p>

      <section aria-labelledby="map-results">
        <div className="section-head">
          <h2 id="map-results" className="heading">{data.query === "" ? "Results" : `“${data.query}”`}</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>
            {String(data.hits.length).padStart(2, "0")}
          </span>
        </div>

        {data.query === "" ? (
          <p className="lead" style={{ paddingTop: 24 }}>Type a phrase above to start.</p>
        ) : data.hits.length === 0 ? (
          <p className="lead" style={{ paddingTop: 24 }}>
            Nothing in your recordings says “{data.query}”. Try fewer words, or the words as you would have said them.
          </p>
        ) : (
          <>
            {data.capped ? (
              <p className="quiet" style={{ paddingTop: 20, margin: 0 }}>
                Showing the first {data.limit} results, newest first. There are more: try a longer phrase.
              </p>
            ) : null}
            <div className={styles.hits}>
              {data.hits.map((hit) => (
                <Hit key={hit.key} hit={hit} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

/** What there is to search. Nothing transcribed yet is a real answer, not an error. */
function holdingLine(holding: { transcripts: number; words: number; moments: number }): string {
  if (holding.transcripts === 0 && holding.moments === 0) {
    return "Nothing to search yet. A recording becomes searchable once it has been transcribed.";
  }
  const words = holding.words > 0 ? ` and ${holding.words.toLocaleString("en-GB")} words` : "";
  const moments = holding.moments === 0 ? ", with no moments picked out yet" : `, and ${plural(holding.moments, "moment")} with timings`;
  return `Searching ${plural(holding.transcripts, "transcript")}${words}${moments}.`;
}
