"use client";

import { useState, useTransition } from "react";
import type { ReviewPiece } from "@/lib/data/review.build";
import { restoreVersionAction, savePieceAction } from "./actions";
import styles from "../review.module.css";

const AUTHOR = { agent: "Drafted", person: "You", chat: "Chat" } as const;

/** One piece of text: edit it, pick another title, or bring back an earlier version. */
function PieceCard({ episodeId, piece }: { episodeId: string; piece: ReviewPiece }) {
  const [text, setText] = useState(piece.body);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = text.trim() !== piece.body;
  const over = text.length > piece.limit;

  // A newer saved body (the chat edited it) replaces an untouched editor.
  const [seen, setSeen] = useState(piece.body);
  if (seen !== piece.body) {
    setSeen(piece.body);
    if (!dirty) setText(piece.body);
  }

  const save = (body: string) =>
    start(async () => {
      const r = await savePieceAction(episodeId, piece.id, body);
      setNote(r.message);
    });
  const restore = (version: number) =>
    start(async () => {
      const r = await restoreVersionAction(episodeId, piece.id, version);
      setNote(r.message);
    });

  return (
    <article className={styles.piece}>
      <div className={styles.pieceHead}>
        <span className="label">{piece.label}</span>
        <span className={over ? styles.over : "quiet"}>{text.length} / {piece.limit}</span>
      </div>
      <textarea
        className={piece.kind === "title" ? styles.titleInput : styles.textInput}
        value={text}
        rows={piece.kind === "title" ? 2 : piece.kind === "description" ? 9 : 5}
        onChange={(e) => setText(e.target.value)}
        aria-label={piece.label}
      />
      {piece.kind === "title" && piece.options.length > 1 ? (
        <div className={styles.options}>
          {piece.options.filter((o) => o !== text).map((o) => (
            <button key={o} type="button" className="chip" onClick={() => setText(o)}>{o}</button>
          ))}
        </div>
      ) : null}
      <div className={styles.pieceFoot}>
        <details>
          <summary className="quiet">Version {piece.version} of {piece.versions.length}</summary>
          <ul className={styles.versions}>
            {piece.versions.map((v) => (
              <li key={v.version}>
                <span className="figure">v{v.version}</span> {AUTHOR[v.author]}{v.note ? ` · ${v.note}` : ""}
                {v.version !== piece.version ? (
                  <button type="button" className={styles.restore} disabled={pending} onClick={() => restore(v.version)}>Use this</button>
                ) : <span className="quiet"> · current</span>}
                <p className={styles.versionBody}>{v.body}</p>
              </li>
            ))}
          </ul>
        </details>
        <span className={styles.saveRow}>
          {note ? <span className="quiet" role="status">{note}</span> : null}
          <button type="button" className="btn-gold" disabled={!dirty || over || pending} onClick={() => save(text)}>
            {pending ? "Saving" : "Save"}
          </button>
        </span>
      </div>
    </article>
  );
}

export function Pieces({ episodeId, pieces }: { episodeId: string; pieces: ReviewPiece[] }) {
  if (pieces.length === 0) return <p className="quiet">No text has been written for this episode yet.</p>;
  return (
    <div className={styles.pieces}>
      {pieces.map((p) => <PieceCard key={p.id} episodeId={episodeId} piece={p} />)}
    </div>
  );
}
