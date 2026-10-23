import { getAnalytics } from "@/lib/data";
import { Note } from "@/components/Note";
import { ShowKpis, Sources } from "./Kpis";
import { Audience, Published } from "./Audience";
import styles from "./analytics.module.css";

export const metadata = { title: "Analytics · multi-media os" };

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Analytics</span>
        <h1 className="display">Who it is for, who is watching</h1>
        <p className="lead">
          Every KPI on Vision, with the real number behind it and where that number comes from. Nothing here is dressed up:
          a number no platform reports is marked as typed in by hand.
        </p>
      </header>

      {data === null ? (
        <p className="lead">Add a show first. Each show brings its own goal, its own numbers and its own audience.</p>
      ) : (
        <>
          <section aria-labelledby="standing" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="section-head">
              <h2 id="standing" className="heading">How much of this is real</h2>
              <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>
                {data.tally.measured} of {data.tally.total} measured
              </span>
            </div>
            <span aria-hidden="true" className={styles.meter}>
              <span className={styles.meterMeasured} style={{ width: `${share(data.tally.measured, data.tally.total)}%` }} />
            </span>
            <p className="lead">{data.tally.sentence}</p>
            <Note>
              {data.measuringPlatforms.length === 0
                ? "No platform analytics are connected yet, so no number on this screen is measured. Connecting the first one turns its KPIs real without any further work here."
                : `Reading from ${data.measuringPlatforms.join(", ")}.`}
            </Note>
          </section>

          {data.goals.length === 0 ? (
            <p className="lead">No show has a main goal written yet, so there are no KPIs to check. Write one on Vision and goals.</p>
          ) : (
            data.goals.map((goal) => <ShowKpis key={goal.slug} goal={goal} />)
          )}

          {data.sources.length > 0 ? (
            <section aria-labelledby="sources" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="section-head">
                <h2 id="sources" className="heading">Where the numbers come from</h2>
                <span className="quiet">One row per evidence source</span>
              </div>
              <Sources rows={data.sources} />
            </section>
          ) : null}

          <section aria-labelledby="out" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="section-head">
              <h2 id="out" className="heading">What has gone out</h2>
              <span className="quiet">{data.published.length === 0 ? "Nothing yet" : `${data.published.length} posts`}</span>
            </div>
            <Published rows={data.published} />
          </section>

          <section aria-labelledby="fit" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 id="fit" className="heading">Audience fit</h2>
              <p className="lead">Each show has people it is written for, taken from its brand kit. Whether those are the people watching is not known until a platform reports it.</p>
            </header>
            {data.audience.map((block) => <Audience key={block.slug} block={block} />)}
          </section>
        </>
      )}
    </>
  );
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}
