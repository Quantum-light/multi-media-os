"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { UploadProgress } from "@mmos/media";
import { uploadRecording, type Duplicate, type UploadStage } from "@/lib/uploads/client";
import { formatBytes, formatEta } from "./format";
import styles from "./upload.module.css";

type Show = { id: string; name: string; kind: string };
type State =
  | { kind: "idle" }
  | { kind: "working"; stage: UploadStage; progress: UploadProgress | null; speed: number }
  | { kind: "duplicate"; existing: Duplicate }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function UploadPanel({ shows }: { shows: Show[] }) {
  const [showId, setShowId] = useState(shows[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const stop = useRef<AbortController | null>(null);
  const samples = useRef<{ t: number; bytes: number }[]>([]);

  const run = async (allowDuplicate: boolean) => {
    if (!file || !showId) return;
    const controller = new AbortController();
    stop.current = controller;
    samples.current = [];
    setState({ kind: "working", stage: "checking", progress: null, speed: 0 });
    try {
      const outcome = await uploadRecording(file, showId, {
        allowDuplicate,
        signal: controller.signal,
        onStage: (stage) => setState((s) => (s.kind === "working" ? { ...s, stage } : s)),
        onProgress: (progress) => {
          const now = performance.now();
          const list = [...samples.current, { t: now, bytes: progress.sentBytes }].filter((x) => now - x.t < 4000);
          samples.current = list;
          const first = list[0]!;
          const speed = now - first.t > 500 ? ((progress.sentBytes - first.bytes) / (now - first.t)) * 1000 : 0;
          setState({ kind: "working", stage: "uploading", progress, speed });
        },
      });
      setState(outcome.kind === "duplicate" ? { kind: "duplicate", existing: outcome.existing } : { kind: "done" });
    } catch (error) {
      setState(controller.signal.aborted ? { kind: "idle" } : { kind: "error", message: error instanceof Error ? error.message : "The upload stopped." });
    }
  };

  const busy = state.kind === "working";
  const pick = (f: File | undefined) => {
    if (f && !busy) {
      setFile(f);
      setState({ kind: "idle" });
    }
  };

  return (
    <section className={`${styles.panel} glass`} aria-live="polite">
      <label className={styles.field}>
        <span className="label">Show</span>
        <select value={showId} onChange={(e) => setShowId(e.target.value)} disabled={busy} className={styles.select}>
          {shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>

      <label
        className={`${styles.drop} ${dragging ? styles.dropOn : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
      >
        <input type="file" accept="video/*,audio/*" className={styles.hidden} disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <>
            <span className={styles.fileName}>{file.name}</span>
            <span className="quiet">{formatBytes(file.size)} · choose another to replace it</span>
          </>
        ) : (
          <>
            <span className={styles.fileName}>Drop a recording here</span>
            <span className="quiet">or click to choose · video or audio, any size</span>
          </>
        )}
      </label>

      {state.kind === "working" ? <Progress state={state} onCancel={() => stop.current?.abort()} /> : null}

      {state.kind === "duplicate" ? (
        <div className={styles.notice}>
          <p style={{ margin: 0 }}>
            This recording was uploaded before{state.existing.title ? <> as <strong>{state.existing.title}</strong></> : null}, on{" "}
            {new Date(state.existing.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
          <div className={styles.actions}>
            <button type="button" className="link-gold" style={{ background: "none", border: 0, font: "inherit", cursor: "pointer" }} onClick={() => setState({ kind: "idle" })}>Keep the earlier one</button>
            <button type="button" className="btn-gold" onClick={() => run(true)}>Upload it again anyway</button>
          </div>
        </div>
      ) : null}

      {state.kind === "done" ? (
        <div className={styles.notice}>
          <p style={{ margin: 0 }}>Uploaded. The edit has started; you will find it under In the studio.</p>
          <Link href="/" className="link-gold">Back to Today</Link>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <p className={styles.error} role="alert">{state.message} Press upload again to carry on from where it stopped.</p>
      ) : null}

      {state.kind === "idle" || state.kind === "error" ? (
        <div className={styles.actions}>
          <button type="button" className="btn-gold" disabled={!file || !showId} onClick={() => run(false)}>Upload</button>
        </div>
      ) : null}
    </section>
  );
}

function Progress({ state, onCancel }: { state: Extract<State, { kind: "working" }>; onCancel: () => void }) {
  const p = state.progress;
  const pct = p ? Math.floor((p.sentBytes / p.totalBytes) * 100) : 0;
  const label = state.stage === "checking" ? "Checking the file" : state.stage === "finishing" ? "Joining the pieces" : `${pct}%`;
  const remaining = p && state.speed > 0 ? (p.totalBytes - p.sentBytes) / state.speed : null;
  return (
    <div className={styles.progress}>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Upload progress">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.meta}>
        <span className="figure">{label}</span>
        {p && state.stage === "uploading" ? (
          <span className="quiet figure">
            {formatBytes(p.sentBytes)} of {formatBytes(p.totalBytes)} · {formatBytes(state.speed)}/s{remaining !== null ? ` · ${formatEta(remaining)} left` : ""}
          </span>
        ) : null}
        {state.stage !== "finishing" ? (
          <button type="button" className={styles.cancel} onClick={onCancel}>Cancel</button>
        ) : null}
      </div>
    </div>
  );
}
