import type { ShowGoal, SourceRow } from "@/lib/data/analytics.build";
import styles from "./analytics.module.css";

/** One show's main goal, with every KPI and where its number comes from. */
export function ShowKpis({ goal }: { goal: ShowGoal }) {
  const objectives = [...new Map(goal.kpis.map((k) => [k.objective, k.objective])).keys()];
  return (
    <section aria-labelledby={`goal-${goal.slug}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="section-head">
        <h2 id={`goal-${goal.slug}`} className="heading">{goal.name}</h2>
        <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{goal.progress}% overall</span>
      </div>
      <p style={{ fontFamily: "var(--font-title), Georgia, serif", fontSize: 26, lineHeight: 1.25, margin: "22px 0 0" }}>{goal.statement}</p>
      {goal.by ? <span className="quiet">By {month(goal.by)}</span> : null}

      {objectives.map((title) => (
        <div key={title} className={styles.objective}>
          <span className={styles.objectiveTitle}>{title}</span>
          <div className={styles.kpis}>
            {goal.kpis.filter((k) => k.objective === title).map((k) => (
              <div key={`${title}-${k.name}`} className={styles.kpi}>
                <span className={styles.kpiName}>{k.name}</span>
                <span aria-hidden="true" className={styles.track}>
                  <span className={styles.fill} style={{ width: `${k.progress}%` }} />
                </span>
                <span className={`figure ${styles.figures}`}>
                  {k.current}{k.unit} of {k.target}{k.unit} · {k.progress}%
                </span>
                <span className={styles.kpiSource}>
                  <span className={k.evidence.kind === "measured" ? "chip chip--on" : "chip"}>
                    {k.evidence.kind === "measured" ? "Measured" : "Typed in by hand"}
                  </span>
                  <span>{k.evidence.why}</span>
                  <span className="figure">{k.evidence.source || "no source named"}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

/** Every distinct evidence source once, with the account behind it. */
export function Sources({ rows }: { rows: SourceRow[] }) {
  return (
    <div className={styles.table}>
      <span className={styles.th}>Evidence source</span>
      <span className={styles.th}>Platform</span>
      <span className={styles.th}>Account</span>
      <span className={styles.th}>Number</span>
      {rows.map((r) => (
        <Row key={r.source} row={r} />
      ))}
    </div>
  );
}

function Row({ row }: { row: SourceRow }) {
  return (
    <>
      <span className={`figure ${styles.td}`}>{row.source || "none named"}</span>
      <span className={styles.td}>{row.platform === null ? "None" : row.platform.replaceAll("_", " ")}</span>
      <span className={styles.td}>{row.channel}</span>
      <span className={styles.td}>{row.measured ? "Measured" : "Typed in"}</span>
    </>
  );
}

function month(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
