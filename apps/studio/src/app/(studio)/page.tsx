import Link from "next/link";
import { getShell, getToday } from "@/lib/data";
import { StepThread } from "@/components/StepThread";

export default async function TodayPage() {
  const [shell, data] = await Promise.all([getShell(), getToday()]);
  if (!data) return null;

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
        <span className="eyebrow">{data.dateLabel}</span>
        <h1 className="display">
          {data.greeting}
          {shell.firstName ? <>, <em>{shell.firstName}</em></> : null}
        </h1>
        <p className="lead">{data.summary}</p>
        </div>
        <Link href="/upload" className="btn-gold">Upload a recording</Link>
      </header>

      <section aria-labelledby="for-you">
        <div className="section-head">
          <h2 id="for-you" className="heading">For you</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(data.forYou.length).padStart(2, "0")}</span>
        </div>
        {data.forYou.length === 0 ? (
          <p className="quiet" style={{ padding: "20px 0 0", margin: 0 }}>Nothing needs you right now.</p>
        ) : (
          data.forYou.map((item) => (
            <div key={item.id} className="row">
              {item.kind === "review" ? (
                <span aria-hidden="true" style={{ flex: "0 0 96px", height: 54, borderRadius: 10, background: item.ground ?? "var(--ink-soft)", boxShadow: "0 10px 24px rgba(30,36,50,0.18)" }} />
              ) : (
                <span className="label" style={{ flex: "0 0 96px", color: item.kind === "attention" ? "var(--gold-ink)" : undefined }}>
                  {item.kind === "attention" ? "Needs a look" : "Set up"}
                </span>
              )}
              <div className="row__body">
                <span className="row__title">{item.title}</span>
                <span className="quiet">{item.detail}</span>
              </div>
            </div>
          ))
        )}
      </section>

      <div className="columns">
        <section aria-labelledby="in-studio">
          <h2 id="in-studio" className="heading" style={{ fontSize: 28, marginBottom: 12 }}>In the studio</h2>
          {data.inStudio.length === 0 ? (
            <p className="quiet" style={{ padding: "11px 0", margin: 0, borderTop: "1px solid var(--hairline)" }}>No recordings are being worked on.</p>
          ) : (
            data.inStudio.map((job) => (
              <div key={job.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "18px 0", borderTop: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{job.name}</span>
                  <span className="quiet">{job.stepLabel} · {job.stepIndex + 1} of {job.totalSteps}</span>
                </div>
                <StepThread current={job.stepIndex} total={job.totalSteps} />
                <span className="quiet" style={{ fontSize: 12 }}>{job.show}</span>
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="week">
          <h2 id="week" className="heading" style={{ fontSize: 28, marginBottom: 12 }}>The week ahead</h2>
          {data.week.map((d) => (
            <div key={d.key} style={{ display: "flex", gap: 18, padding: "11px 0", borderTop: "1px solid var(--hairline)" }}>
              <span className="figure" style={{ flex: "0 0 56px", fontSize: 12, color: "var(--gold-ink)" }}>{d.day}</span>
              <span style={{ fontSize: 13, color: d.items === "Nothing scheduled" ? "var(--ink-quiet)" : "var(--ink-soft)" }}>{d.items}</span>
            </div>
          ))}
          <p className="quiet" style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20, margin: 0, fontSize: 12 }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: data.healthy ? "var(--good)" : "var(--gold)" }} />
            {data.healthNote}
          </p>
        </section>
      </div>
    </>
  );
}
