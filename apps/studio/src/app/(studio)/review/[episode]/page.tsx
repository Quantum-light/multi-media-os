import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewEpisode } from "@/lib/data";
import { Approve } from "./Approve";
import { Chat } from "./Chat";
import { Pieces } from "./Pieces";
import { Player } from "./Player";
import styles from "../review.module.css";

export const metadata = { title: "Review · multi-media os" };

export default async function ReviewEpisodePage({ params }: { params: Promise<{ episode: string }> }) {
  const { episode } = await params;
  if (!/^[0-9a-f-]{36}$/.test(episode)) notFound();
  const data = await getReviewEpisode(episode);
  if (!data) notFound();
  const scheduled = data.posts.filter((p) => p.when).length;

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <Link href="/review" className="eyebrow" style={{ textDecoration: "none" }}>Review · {data.show}</Link>
          <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>{data.title}</h1>
          {data.summary ? <p className="lead">{data.summary}</p> : null}
          {data.flagged ? <p className="quiet" style={{ color: "var(--gold-ink)", margin: 0 }}>This looks like a recording you already have.</p> : null}
        </div>
        {data.state === "review" ? <Approve episodeId={data.id} canApprove={data.canApprove} posts={scheduled} /> : <span className="label">{data.state === "approved" ? "Approved" : data.state}</span>}
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          <Player src={data.previewUrl} cuts={data.cuts} durationS={data.durationS} keptS={data.keptS} />

          <section aria-labelledby="text" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="section-head"><h2 id="text" className="heading">The text</h2></div>
            <Pieces episodeId={data.id} pieces={data.pieces} />
          </section>
        </div>

        <aside className={styles.side}>
          <section aria-labelledby="posts">
            <h2 id="posts" className="heading" style={{ fontSize: 24, marginBottom: 8 }}>Where it goes</h2>
            {data.posts.length === 0 ? (
              <p className="quiet">This show has no connected channels yet.</p>
            ) : (
              data.posts.map((p) => (
                <div key={p.channelId} className={styles.post}>
                  <span style={{ fontWeight: 500 }}>{p.handle}</span>
                  <span className="quiet">{p.platform} · {p.when ?? "no free slot in the next three weeks"}</span>
                </div>
              ))
            )}
          </section>

          {data.clipSlate ? (
            <section aria-labelledby="clips">
              <h2 id="clips" className="heading" style={{ fontSize: 24, marginBottom: 8 }}>Short clips</h2>
              <p className="quiet" style={{ marginTop: 0 }}>{data.clipSlate.line}</p>
              <Link href={`/review/${data.id}/clips`} className="link-gold">Open Clip Studio</Link>
            </section>
          ) : null}

          <Chat episodeId={data.id} ready={data.chatReady} />
        </aside>
      </div>
    </>
  );
}
