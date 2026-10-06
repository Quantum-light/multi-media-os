"use client";

import { emptyKpi, type KpiDraft, type ObjectiveDraft } from "./draft";
import styles from "./edit.module.css";

type Props = { index: number; objective: ObjectiveDraft; onChange: (next: ObjectiveDraft) => void };

/** One objective under the main goal, with the numbers that show whether it is happening. */
export function ObjectiveFields({ index, objective, onChange }: Props) {
  const setKpi = (i: number, next: KpiDraft) => onChange({ ...objective, kpis: objective.kpis.map((k, j) => (j === i ? next : k)) });

  return (
    <fieldset className={styles.objective}>
      <legend className={styles.legend}>
        <span className="figure" style={{ color: "var(--gold-ink)", marginRight: 10 }}>{String(index + 1).padStart(2, "0")}</span>
        Objective
      </legend>

      <label className={styles.field}>
        <span className="label">What has to be true</span>
        <input className={styles.input} value={objective.title} placeholder="Show up consistently" onChange={(e) => onChange({ ...objective, title: e.target.value })} />
      </label>

      {objective.kpis.map((kpi, i) => (
        <div key={i} className={styles.kpi}>
          <label className={styles.field}>
            <span className="label">What you measure</span>
            <input className={styles.input} value={kpi.name} placeholder="Episodes a month" onChange={(e) => setKpi(i, { ...kpi, name: e.target.value })} />
          </label>
          <div className={styles.numbers}>
            <label className={styles.field}>
              <span className="label">Now</span>
              <input className={styles.input} inputMode="decimal" value={kpi.current} onChange={(e) => setKpi(i, { ...kpi, current: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className="label">Target</span>
              <input className={styles.input} inputMode="decimal" value={kpi.target} onChange={(e) => setKpi(i, { ...kpi, target: e.target.value })} />
            </label>
            <label className={styles.field}>
              <span className="label">Unit</span>
              <input className={styles.input} value={kpi.unit} placeholder="%" onChange={(e) => setKpi(i, { ...kpi, unit: e.target.value })} />
            </label>
          </div>
          <label className={styles.field}>
            <span className="label">Where the number comes from</span>
            <input className={styles.input} value={kpi.evidenceSource} placeholder="youtube_analytics.returning_viewers" onChange={(e) => setKpi(i, { ...kpi, evidenceSource: e.target.value })} />
          </label>
          {objective.kpis.length > 1 ? (
            <button type="button" className={styles.remove} onClick={() => onChange({ ...objective, kpis: objective.kpis.filter((_, j) => j !== i) })}>
              Remove this number
            </button>
          ) : null}
        </div>
      ))}

      <button type="button" className="link-gold" style={{ alignSelf: "flex-start", background: "none", border: 0, font: "inherit", cursor: "pointer", padding: 0 }} onClick={() => onChange({ ...objective, kpis: [...objective.kpis, emptyKpi()] })}>
        Add another number
      </button>
    </fieldset>
  );
}
