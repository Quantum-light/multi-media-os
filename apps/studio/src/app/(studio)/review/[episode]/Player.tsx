"use client";

import { useRef, useState } from "react";
import { skipCuts } from "@/lib/data/review.build";
import styles from "../review.module.css";

type Cut = { startS: number; endS: number; reason: string; text: string };
type Props = { src: string | null; cuts: Cut[]; durationS: number | null; keptS: number | null };

const REASON: Record<string, string> = { silence: "Pause", filler: "Filler", false_start: "False start", retake: "Retake" };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** The 540p preview with the proposed cuts skipped as it plays. Nothing is re-encoded. */
export function Player({ src, cuts, durationS, keptS }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [withCuts, setWithCuts] = useState(true);

  const onTime = () => {
    const v = video.current;
    if (!v || !withCuts) return;
    const next = skipCuts(v.currentTime, cuts);
    if (next !== v.currentTime) v.currentTime = next;
  };
  const jump = (s: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, s - 2);
    void v.play();
  };

  return (
    <div className={styles.player}>
      {src ? (
        <video ref={video} className={styles.video} src={src} controls preload="metadata" onTimeUpdate={onTime} />
      ) : (
        <div className={styles.videoEmpty}>The preview is not ready yet.</div>
      )}
      <div className={styles.playerBar}>
        <span className="quiet">
          {durationS && keptS ? `${mmss(durationS)} recorded · ${mmss(keptS)} after ${cuts.length} cuts` : "No cut list yet"}
        </span>
        <label className={styles.toggle}>
          <input type="checkbox" checked={withCuts} onChange={(e) => setWithCuts(e.target.checked)} /> Play with the cuts
        </label>
      </div>
      {cuts.length > 0 ? (
        <details className={styles.cuts}>
          <summary>The cut list</summary>
          <ol>
            {cuts.map((c) => (
              <li key={`${c.startS}-${c.endS}`}>
                <button type="button" className={styles.cutJump} onClick={() => jump(c.startS)}>
                  <span className="figure">{mmss(c.startS)}</span> {REASON[c.reason] ?? c.reason} · {(c.endS - c.startS).toFixed(1)} s
                </button>
                {c.text ? <span className="quiet"> “{c.text}”</span> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
