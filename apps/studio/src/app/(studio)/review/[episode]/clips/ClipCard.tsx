import type { ClipCard as Clip } from "@/lib/data/clips.build";
import { Decide } from "./Decide";
import styles from "./clips.module.css";

type Props = { episodeId: string; clip: Clip; canDecide: boolean };

const STATE_WORDS: Record<Clip["state"], string | null> = {
  chosen: null,
  reserve: "In reserve",
  approved: "Approved",
  rejected: "Set aside",
};

/** One clip: what it claims, what was said, and where it sits in the recording. */
export function ClipCard({ episodeId, clip, canDecide }: Props) {
  const word = STATE_WORDS[clip.state];
  return (
    <article className={clip.state === "rejected" ? `${styles.clip} ${styles.clipAside}` : styles.clip}>
      <div className={styles.clipHead}>
        <span className={`figure ${styles.rank}`}>{String(clip.rank).padStart(2, "0")}</span>
        <div className={styles.clipMeta}>
          <span className="label">{clip.signal}</span>
          <span className="quiet figure">
            {clip.span} · {clip.length} · scores {clip.score} of 100
          </span>
        </div>
        {word ? <span className={styles.state}>{word}</span> : null}
      </div>

      <h3 className={styles.hook}>{clip.hook}</h3>
      <blockquote className={styles.quote}>{clip.quote}</blockquote>
      <p className={styles.reason}>{clip.reason}</p>

      <Decide episodeId={episodeId} clipId={clip.id} state={clip.state} canDecide={canDecide} />
    </article>
  );
}
