import Link from "next/link";
import { notFound } from "next/navigation";
import { getEpisode, type EpisodeStep } from "@/lib/data";
import { STEP_LABELS } from "@/lib/steps";
import { TranscriptPanel } from "./TranscriptPanel";
import styles from "../episodes.module.css";

export const metadata = { title: "Episode · multi-media os" };

type Props = { params: Promise<{ id: string }> };

const FILE_NAMES: Record<string, string> = {
  source: "The recording",
  audio: "Audio only",
  edit: "540p preview",
  master: "Master",
  clip: "Clip",
  image: "Image",
  render: "Render",
};

export default async function EpisodePage({ params }: Props) {
  const { id } = await params;
  const episode = await getEpisode(id);
  if (!episode) notFound();

  const stopped = episode.steps.find((s) => s.status === "failed");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <span className="eyebrow">{episode.show.name}</span>
          <h1 className="display">{episode.title}</h1>
          <p className="lead">Put in {when(episode.createdAt)}. {episode.flags.length > 0 ? episode.flags.join(" · ") : ""}</p>
        </header>
        <Link href="/episodes" className="link-gold">All episodes</Link>
      </div>

      {stopped ? (
        <div style={{ padding: "18px 20px", borderRadius: 16, background: "rgba(180, 80, 63, 0.1)", fontSize: 14 }} role="alert">
          <strong>{STEP_LABELS[stopped.step]} stopped.</strong> {stopped.error ?? "No reason was recorded."}
        </div>
      ) : null}

      <section aria-labelledby="progress">
        <div className="section-head">
          <h2 id="progress" className="heading">How far it has got</h2>
          <span className="quiet">{episode.steps.filter((s) => s.status === "succeeded").length} of {episode.steps.length} done</span>
        </div>
        <ol className={styles.steps}>
          {episode.steps.map((step) => (
            <li key={step.step} className={styles.step}>
              <span aria-hidden="true" className={`${styles.dot} ${dotClass(step)}`} />
              <span className={styles.stepName}>{STEP_LABELS[step.step]}</span>
              <span className={styles.stepWhen}>{describe(step)}</span>
              {step.error ? <span className={styles.stepError}>{step.error}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="transcript" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="section-head">
          <h2 id="transcript" className="heading">What was said</h2>
          {episode.transcript ? (
            <span className="quiet">{episode.transcript.words.toLocaleString("en-GB")} words · {episode.transcript.segments.toLocaleString("en-GB")} segments</span>
          ) : null}
        </div>
        {episode.transcript ? (
          <TranscriptPanel episodeId={episode.id} />
        ) : (
          <p className="quiet" style={{ margin: 0 }}>Not transcribed yet. It appears here as soon as that step runs.</p>
        )}
      </section>

      <section aria-labelledby="files">
        <div className="section-head">
          <h2 id="files" className="heading">Files</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(episode.files.length).padStart(2, "0")}</span>
        </div>
        {episode.files.length === 0 ? <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>Nothing stored yet.</p> : null}
        <dl className={styles.files} style={{ paddingTop: 20 }}>
          {episode.files.map((file) => (
            <div key={file.key} style={{ display: "contents" }}>
              <dt>{FILE_NAMES[file.kind] ?? file.kind}</dt>
              <dd className="quiet">{file.key.split("/").pop()}</dd>
              <dd className="figure" style={{ fontSize: 12 }}>{size(file.bytes)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="shorts" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="section-head">
          <h2 id="shorts" className="heading">Shorts</h2>
        </div>
        <p className="quiet" style={{ margin: 0 }}>
          The finder reads the transcript, scores every moment against the four signals, and offers a ranked slate with the rest held in reserve.{" "}
          <Link href={`/review/${episode.id}/clips`} className="link-gold">Open Clip Studio</Link>
        </p>
      </section>
    </>
  );
}

function dotClass(step: EpisodeStep): string {
  if (step.status === "succeeded") return styles.dotDone ?? "";
  if (step.status === "failed") return styles.dotStopped ?? "";
  if (step.status === "running" || step.status === "queued") return styles.dotNow ?? "";
  return "";
}

function describe(step: EpisodeStep): string {
  if (step.status === "not started") return "";
  if (step.status === "queued") return "waiting";
  if (step.status === "running") return "running now";
  if (step.status === "failed") return `stopped after ${step.attempts} ${step.attempts === 1 ? "try" : "tries"}`;
  if (step.status === "cancelled") return "cancelled";
  return step.at ? when(step.at) : "done";
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function size(bytes: number | null): string {
  if (bytes === null) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
