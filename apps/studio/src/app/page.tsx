import Link from "next/link";
import { getToday } from "@/lib/data";
import { StepThread } from "@/components/StepThread";
import { SampleNote } from "@/components/SampleNote";

export default async function TodayPage() {
  const data = await getToday();

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
          <span className="eyebrow">{data.dateLabel}</span>
          <h1 className="display">
            Good morning, <em>Grace</em>
          </h1>
          <p className="lead">{data.summary}</p>
        </div>
        <Link href="/" className="btn-gold">Upload a recording</Link>
      </header>

      <section aria-labelledby="for-you">
        <div className="section-head">
          <h2 id="for-you" className="heading">For you</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(data.forYou.length).padStart(2, "0")}</span>
        </div>
        {data.forYou.map((item) => (
          <div key={item.id} className="row">
            {item.kind === "review" ? (
              <span aria-hidden="true" style={{ flex: "0 0 96px", height: 54, borderRadius: 10, background: "#2a1d16", boxShadow: "0 10px 24px rgba(30,36,50,0.18)" }} />
            ) : item.kind === "ideas" ? (
              <span className="figure" style={{ flex: "0 0 96px", fontSize: 28, color: "var(--gold-ink)" }}>{item.count}</span>
            ) : (
              <span className="quiet" style={{ flex: "0 0 96px" }}>Step 2 of 3</span>
            )}
            <div className="row__body">
              <span className="row__title">{item.title}</span>
              <span className="quiet">{item.detail}</span>
            </div>
            <Link href={item.href} className={item.primary ? "btn-gold" : "link-gold"}>{item.cta}</Link>
          </div>
        ))}
      </section>

      <div className="columns">
        <section aria-labelledby="in-studio">
          <h2 id="in-studio" className="heading" style={{ fontSize: 28, marginBottom: 12 }}>In the studio</h2>
          {data.inStudio.map((job) => (
            <div key={job.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 0", borderTop: "1px solid var(--hairline)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 500 }}>{job.name}</span>
                <span className="quiet">{job.stepLabel} · {job.stepIndex + 1} of {job.totalSteps}</span>
              </div>
              <StepThread current={job.stepIndex} total={job.totalSteps} />
              <span className="quiet" style={{ fontSize: 12 }}>{job.show}</span>
            </div>
          ))}
        </section>

        <section aria-labelledby="week">
          <h2 id="week" className="heading" style={{ fontSize: 28, marginBottom: 12 }}>The week ahead</h2>
          {data.week.map((d) => (
            <div key={d.day} style={{ display: "flex", gap: 18, padding: "11px 0", borderTop: "1px solid var(--hairline)" }}>
              <span className="figure" style={{ flex: "0 0 56px", fontSize: 12, color: "var(--gold-ink)" }}>{d.day}</span>
              <span style={{ fontSize: 13, color: "#4c525e" }}>{d.items}</span>
            </div>
          ))}
          <p className="quiet" style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20, margin: 0, fontSize: 12 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: data.healthy ? "var(--good)" : "var(--gold)" }} />
            {data.healthy ? "All systems well · nothing stuck · no duplicates" : "Something needs a look"}
          </p>
        </section>
      </div>

      {data.isSample ? <SampleNote /> : null}
    </>
  );
}
