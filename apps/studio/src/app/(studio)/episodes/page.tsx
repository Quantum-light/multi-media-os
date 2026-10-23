import Link from "next/link";
import { getEpisodes } from "@/lib/data";
import { STEP_LABELS } from "@/lib/steps";
import type { StepName } from "@mmos/contracts";
import styles from "./episodes.module.css";

export const metadata = { title: "Episodes · multi-media os" };

const STATE: Record<string, string> = {
  uploading: "Uploading",
  ingesting: "Taking it in",
  processing: "In the studio",
  review: "Waiting for you",
  approved: "Approved",
  published: "Published",
  failed: "Stopped",
};

export default async function EpisodesPage() {
  const episodes = await getEpisodes();
  if (!episodes) return null;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <span className="eyebrow">Your recordings</span>
          <h1 className="display">Episodes</h1>
          <p className="lead">Every recording you have put in, and everything that has been made from it. Open one to see where it got to, read its transcript, and look at what came out.</p>
        </header>
        <Link href="/upload" className="btn-gold">Upload a recording</Link>
      </div>

      {episodes.length === 0 ? (
        <p className="lead">Nothing uploaded yet. The first recording you put in will appear here.</p>
      ) : (
        <div className={styles.grid}>
          {episodes.map((episode) => (
            <Link key={episode.id} href={`/episodes/${episode.id}`} className={`${styles.card} glass`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <h2 className={styles.title}>{episode.title}</h2>
                <span className="label">{episode.showName}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span className={episode.stopped ? "chip" : "chip chip--on"}>{STATE[episode.state] ?? episode.state}</span>
                <span className="quiet">
                  {episode.stopped ? "stopped at " : ""}
                  {STEP_LABELS[episode.stepLabel as StepName] ?? episode.stepLabel}
                </span>
              </div>
              <span className="quiet">{when(episode.createdAt)}</span>
              {episode.flags.length > 0 ? <span className="quiet">{episode.flags.join(" · ")}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
