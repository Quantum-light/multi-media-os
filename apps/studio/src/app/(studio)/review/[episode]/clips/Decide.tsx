"use client";

import { useState, useTransition } from "react";
import type { SaveResult } from "@/lib/save";
import type { ClipState } from "@/lib/data/clips.build";
import { approveClip, promoteClip, rejectClip } from "./actions";
import styles from "./clips.module.css";

type Props = { episodeId: string; clipId: string; state: ClipState; canDecide: boolean };

/** The three decisions a person can make about one clip, and nothing else. */
export function Decide({ episodeId, clipId, state, canDecide }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SaveResult | null>(null);
  if (!canDecide) return null;

  const run = (action: (e: string, c: string) => Promise<SaveResult>) =>
    start(async () => {
      setResult(null);
      setResult(await action(episodeId, clipId));
    });

  return (
    <div className={styles.decide}>
      {state === "reserve" ? (
        <button type="button" className="btn-gold" disabled={pending} onClick={() => run(promoteClip)}>
          {pending ? "Pulling up" : "Pull up"}
        </button>
      ) : (
        <button type="button" className="btn-gold" disabled={pending || state === "approved"} onClick={() => run(approveClip)}>
          {state === "approved" ? "Approved" : pending ? "Saving" : "Approve"}
        </button>
      )}
      {state === "rejected" ? null : (
        <button type="button" className={styles.quietBtn} disabled={pending} onClick={() => run(rejectClip)}>
          Reject
        </button>
      )}
      {result && !result.ok ? (
        <span className="quiet" role="alert">
          {result.message} {result.problems.join(" ")}
        </span>
      ) : null}
    </div>
  );
}
