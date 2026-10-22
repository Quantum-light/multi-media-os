import Link from "next/link";
import { getReviewList } from "@/lib/data";

export const metadata = { title: "Review · multi-media os" };

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ approved?: string }> }) {
  const [list, { approved }] = await Promise.all([getReviewList(), searchParams]);
  if (!list) return null;
  const scheduled = approved !== undefined ? Number.parseInt(approved, 10) : null;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
        <span className="eyebrow">The one gate</span>
        <h1 className="display">Ready for <em>review</em></h1>
        <p className="lead">Watch the cut, read the text, ask for any change, then approve once. Everything is scheduled from here.</p>
        {scheduled !== null && Number.isFinite(scheduled) ? (
          <p role="status" style={{ margin: 0, color: "var(--good)" }}>Approved. {scheduled === 1 ? "1 post is" : `${scheduled} posts are`} scheduled.</p>
        ) : null}
      </header>

      <section aria-labelledby="waiting">
        <div className="section-head">
          <h2 id="waiting" className="heading">Waiting for you</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(list.length).padStart(2, "0")}</span>
        </div>
        {list.length === 0 ? (
          <p className="quiet" style={{ padding: "20px 0 0", margin: 0 }}>Nothing is waiting. New recordings arrive here once they are cut and written.</p>
        ) : (
          list.map((e) => (
            <div key={e.id} className="row">
              <div className="row__body">
                <Link href={`/review/${e.id}`} className="row__title" style={{ textDecoration: "none" }}>{e.title}</Link>
                <span className="quiet">{e.show} · ready since {e.waitingSince}{e.flagged ? " · looks like a recording you already have" : ""}</span>
              </div>
              <Link href={`/review/${e.id}`} className="link-gold">Review</Link>
            </div>
          ))
        )}
      </section>
    </>
  );
}
