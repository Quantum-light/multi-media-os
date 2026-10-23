import Link from "next/link";
import type { MapHit } from "@/lib/data";
import styles from "./map.module.css";

const KINDS: Record<string, string> = {
  quote: "A line worth keeping",
  story: "A story",
  lesson: "A lesson",
  question: "A question",
  claim: "A claim",
  hook: "An opening",
};

/** One place the phrase was said: when, where, and the sentence around it. */
export function Hit({ hit }: { hit: MapHit }) {
  return (
    <Link href={`/episodes/${hit.episodeId}`} className={styles.hit}>
      <span className={hit.at ? `${styles.at} figure` : styles.atNone}>{hit.at ?? "no timing"}</span>
      <span className={styles.body}>
        <span className={styles.said}>
          {hit.snippet.trimmedStart ? "… " : null}
          {hit.snippet.parts.map((part, i) =>
            part.hit ? (
              <mark key={i} className={styles.phrase}>{part.text}</mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
          {hit.snippet.trimmedEnd ? " …" : null}
        </span>
        <span className={styles.meta}>
          <span className={styles.episode}>{hit.episodeTitle}</span>
          <span className="label">{hit.showName}</span>
          {hit.momentKind ? <span className="chip chip--on">{KINDS[hit.momentKind] ?? hit.momentKind}</span> : null}
          {hit.mentions ? <span className="quiet">{hit.mentions}</span> : null}
        </span>
      </span>
    </Link>
  );
}
