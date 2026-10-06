import Link from "next/link";
import type { Compass } from "@mmos/contracts";
import { getVision } from "@/lib/data";
import { overallProgress } from "@/lib/format";
import { Objective } from "@/components/Objective";
import { Note } from "@/components/Note";
import { VisionEditor } from "./VisionEditor";

export const metadata = { title: "Vision and goals · multi-media os" };

type Props = { searchParams: Promise<{ show?: string; edit?: string }> };

export default async function VisionPage({ searchParams }: Props) {
  const { show, edit } = await searchParams;
  const data = await getVision(show);
  if (!data) {
    return <Intro eyebrow="Vision and goals" lead="Add a show first. Each show gets its own vision, pillars and goal." />;
  }

  if (edit === "1") {
    return <VisionEditor slug={data.current.slug} showName={data.current.name} compass={data.state.kind === "ready" ? data.state.compass : null} />;
  }

  const editHref = `/vision?show=${data.current.slug}&edit=1`;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <Intro eyebrow={data.current.name} lead="Get clear on what this show is for, then let everything you make build towards it. Every number names where it comes from." />
        {data.state.kind === "ready" ? <Link href={editHref} className="link-gold">Edit</Link> : null}
      </div>

      {data.shows.length > 1 ? (
        <nav aria-label="Shows" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: -24 }}>
          {data.shows.map((s) => (
            <Link key={s.slug} href={`/vision?show=${s.slug}`} aria-current={s.slug === data.current.slug ? "page" : undefined} className={s.slug === data.current.slug ? "chip chip--on" : "chip"}>
              {s.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {data.state.kind === "missing" ? (
        <Empty
          lead={`No vision written for ${data.current.name} yet. It needs what the show is, its mission, its pillars, and one main goal with three objectives.`}
          href={editHref}
          cta="Write the vision"
        />
      ) : data.state.kind === "invalid" ? (
        <Empty
          lead={`The vision saved for ${data.current.name} is incomplete, so it is not shown here. Writing it again is the quickest way through.`}
          href={editHref}
          cta="Write it again"
        />
      ) : (
        <CompassView compass={data.state.compass} />
      )}
    </>
  );
}

function Intro({ eyebrow, lead }: { eyebrow: string; lead: string }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="display">Vision and goals</h1>
      <p className="lead">{lead}</p>
    </header>
  );
}

function Empty({ lead, href, cta }: { lead: string; href: string; cta: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
      <p className="lead">{lead}</p>
      <Link href={href} className="btn-gold">{cta}</Link>
    </div>
  );
}

function CompassView({ compass }: { compass: Compass }) {
  const progress = overallProgress(compass.mainGoal.objectives.flatMap((o) => o.kpis));
  return (
    <>
      <section aria-labelledby="what" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32 }}>
        <h2 id="what" className="heading" style={{ gridColumn: "1 / -1", paddingBottom: 16, borderBottom: "1px solid var(--gold-hairline)" }}>What it is</h2>
        <Statement label="In one line" text={compass.whatItIs} />
        <Statement label="Mission" text={compass.mission} />
        {compass.howYouSeeIt ? <Statement label="How you see it" text={`“${compass.howYouSeeIt}”`} serif /> : null}
        <Statement label="Vision" text={compass.vision} />
      </section>

      <section aria-labelledby="pillars">
        <div className="section-head">
          <h2 id="pillars" className="heading">Core pillars</h2>
          <span className="quiet">Shares appear once published pieces are tagged</span>
        </div>
        <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28, padding: "24px 0 0", margin: 0, listStyle: "none" }}>
          {compass.pillars.map((p, i) => (
            <li key={p} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontWeight: 500 }}>{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="goal" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="section-head">
          <h2 id="goal" className="heading">The main goal</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{progress}% overall</span>
        </div>
        <p style={{ fontFamily: "var(--font-title), Georgia, serif", fontSize: 32, lineHeight: 1.2, margin: "24px 0 4px" }}>{compass.mainGoal.statement}</p>
        <span className="quiet">By {formatMonth(compass.mainGoal.by)} · measured by three objectives</span>
        {compass.mainGoal.objectives.map((o, i) => (
          <Objective key={o.title} index={i + 1} title={o.title} kpis={o.kpis} />
        ))}
      </section>

      {compass.isDraft ? <Note>Draft. These numbers were typed in by hand; each switches to its evidence source once that source is connected.</Note> : null}
    </>
  );
}

function Statement({ label, text, serif = false }: { label: string; text: string; serif?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="label">{label}</span>
      <span style={serif ? { fontFamily: "var(--font-title), Georgia, serif", fontSize: 22, lineHeight: 1.35 } : { fontSize: 15 }}>{text}</span>
    </div>
  );
}

function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
