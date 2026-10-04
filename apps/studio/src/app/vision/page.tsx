import { getVision } from "@/lib/data";
import { SampleNote } from "@/components/SampleNote";
import { Objective } from "@/components/Objective";

export const metadata = { title: "Vision and goals · multi-media os" };

export default async function VisionPage() {
  const { showName, compass, pillarShares, isSample } = await getVision();
  const progress = overallProgress(compass.mainGoal.objectives.flatMap((o) => o.kpis));

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">{showName}</span>
        <h1 className="display">Vision and goals</h1>
        <p className="lead">Get clear on what this show is for, then let everything you make build towards it. Every number comes from evidence you can open.</p>
      </header>

      <section aria-labelledby="what" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 32 }}>
        <h2 id="what" className="heading" style={{ gridColumn: "1 / -1", paddingBottom: 16, borderBottom: "1px solid var(--gold-hairline)" }}>What it is</h2>
        <Statement label="In one line" text={compass.whatItIs} />
        <Statement label="Mission" text={compass.mission} />
        <Statement label="How you see it" text={`“${compass.howYouSeeIt}”`} serif />
        <Statement label="Vision" text={compass.vision} />
      </section>

      <section aria-labelledby="pillars">
        <div className="section-head">
          <h2 id="pillars" className="heading">Core pillars</h2>
          <span className="quiet">Share of the last 30 days</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28, paddingTop: 24 }}>
          {compass.pillars.map((p) => {
            const share = pillarShares[p] ?? 0;
            return (
              <div key={p} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontWeight: 500 }}>{p}</span>
                <span aria-hidden="true" style={{ height: 2, background: "rgba(46,52,66,0.1)" }}>
                  <span style={{ display: "block", width: `${share}%`, height: 2, background: "var(--gold)" }} />
                </span>
                <span className="figure quiet" style={{ fontSize: 12 }}>{share}%</span>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="goal" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="section-head">
          <h2 id="goal" className="heading">The main goal</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{progress}% overall</span>
        </div>
        <p style={{ fontFamily: "var(--font-title), Georgia, serif", fontSize: 32, lineHeight: 1.2, margin: "24px 0 4px" }}>{compass.mainGoal.statement}</p>
        <span className="quiet">By {formatDate(compass.mainGoal.by)} · measured by three objectives</span>
        {compass.mainGoal.objectives.map((o, i) => (
          <Objective key={o.title} index={i + 1} title={o.title} kpis={o.kpis} />
        ))}
      </section>

      {isSample ? <SampleNote /> : null}
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

function overallProgress(kpis: { current: number; target: number }[]): number {
  if (kpis.length === 0) return 0;
  const sum = kpis.reduce((acc, k) => acc + Math.min(1, k.target === 0 ? 1 : k.current / k.target), 0);
  return Math.round((sum / kpis.length) * 100);
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
