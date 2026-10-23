"use client";

import { useEffect, useState } from "react";
import type { Transcript } from "@mmos/contracts";
import styles from "../episodes.module.css";

type State = { kind: "loading" } | { kind: "ready"; transcript: Transcript } | { kind: "problem"; message: string };

/**
 * The transcript is fetched rather than rendered on the server: it is large,
 * it lives in storage rather than the database, and the page is useful before
 * it arrives.
 */
export function TranscriptPanel({ episodeId }: { episodeId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    fetch(`/api/episodes/${episodeId}/transcript`)
      .then(async (response) => {
        const body = (await response.json()) as { message?: string };
        if (!current) return;
        if (!response.ok) setState({ kind: "problem", message: body.message ?? "The transcript could not be read." });
        else setState({ kind: "ready", transcript: body as unknown as Transcript });
      })
      .catch(() => current && setState({ kind: "problem", message: "The transcript could not be read." }));
    return () => {
      current = false;
    };
  }, [episodeId]);

  if (state.kind === "loading") return <p className="quiet" style={{ margin: 0 }}>Reading the transcript…</p>;
  if (state.kind === "problem") return <p className="quiet" role="alert" style={{ margin: 0, color: "var(--gold-ink)" }}>{state.message}</p>;

  return (
    <div className={styles.transcript}>
      {state.transcript.segments.map((segment, i) => (
        <p key={`${segment.startS}-${i}`} className={styles.line}>
          <span className={`${styles.at} figure`}>{clock(segment.startS)}</span>
          <span className={styles.said}>{segment.text}</span>
        </p>
      ))}
    </div>
  );
}

function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
