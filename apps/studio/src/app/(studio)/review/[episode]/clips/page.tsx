import Link from "next/link";
import { notFound } from "next/navigation";
import { getClipStudio } from "@/lib/data";
import { ClipCard } from "./ClipCard";
import styles from "./clips.module.css";

export const metadata = { title: "Clip Studio · multi-media os" };

export default async function ClipStudioPage({ params }: { params: Promise<{ episode: string }> }) {
  const { episode } = await params;
  if (!/^[0-9a-f-]{36}$/.test(episode)) notFound();
  const data = await getClipStudio(episode);
  if (!data) notFound();
  const { slate } = data;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <Link href={`/review/${data.episodeId}`} className="eyebrow" style={{ textDecoration: "none" }}>
          Review · {data.show}
        </Link>
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
          Clip <em>Studio</em>
        </h1>
        <p className="lead">{data.title}</p>
        {slate.empty ? null : (
          <>
            <p className="lead" role="status" style={{ margin: 0 }}>
              {slate.countLine}
            </p>
            {slate.shortfallLine ? (
              <p style={{ margin: 0, color: "var(--gold-ink)" }}>{slate.shortfallLine}</p>
            ) : null}
          </>
        )}
      </header>

      {slate.empty ? (
        <section aria-labelledby="none" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="section-head">
            <h2 id="none" className="heading">
              Nothing yet
            </h2>
          </div>
          <p className="quiet" style={{ margin: 0, maxWidth: 620 }}>
            The finder has not run for this episode yet. Once it does, this board shows the slate it offers: each clip in
            rank order with the signal it claims, its score, the hook in your own words, the quote, why it clears the bar,
            and where it sits in the recording. Anything else that cleared the bar waits below, in reserve.
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="chosen" className={styles.group}>
            <div className="section-head">
              <h2 id="chosen" className="heading">
                The slate
              </h2>
              <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>
                {String(slate.chosen.length).padStart(2, "0")}
                {slate.target === null ? "" : ` / ${String(slate.target).padStart(2, "0")}`}
              </span>
            </div>
            {slate.chosen.length === 0 ? (
              <p className="quiet" style={{ margin: 0 }}>
                Nothing is chosen. Every clip from this run is either in reserve or set aside.
              </p>
            ) : (
              slate.chosen.map((clip) => (
                <ClipCard key={clip.id} episodeId={data.episodeId} clip={clip} canDecide={data.canDecide} />
              ))
            )}
          </section>

          <section aria-labelledby="reserve" className={styles.group}>
            <div className="section-head">
              <h2 id="reserve" className="heading">
                Held in reserve
              </h2>
              <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>
                {String(slate.reserve.length).padStart(2, "0")}
              </span>
            </div>
            {slate.reserve.length === 0 ? (
              <p className="quiet" style={{ margin: 0 }}>
                Nothing is in reserve. This run offered only the slate above.
              </p>
            ) : (
              slate.reserve.map((clip) => (
                <ClipCard key={clip.id} episodeId={data.episodeId} clip={clip} canDecide={data.canDecide} />
              ))
            )}
          </section>

          {slate.setAside.length > 0 ? (
            <section aria-labelledby="aside" className={styles.group}>
              <div className="section-head">
                <h2 id="aside" className="heading">
                  Set aside
                </h2>
                <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>
                  {String(slate.setAside.length).padStart(2, "0")}
                </span>
              </div>
              <p className="quiet" style={{ margin: 0 }}>
                Rejected, and kept so the record of what was offered stays whole.
              </p>
              {slate.setAside.map((clip) => (
                <ClipCard key={clip.id} episodeId={data.episodeId} clip={clip} canDecide={data.canDecide} />
              ))}
            </section>
          ) : null}

          {data.canDecide ? null : (
            <p className="quiet" style={{ margin: 0 }}>
              You can read this board. An owner, editor or approver decides on a clip.
            </p>
          )}
        </>
      )}
    </>
  );
}
