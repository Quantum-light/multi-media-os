"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Compass } from "@mmos/contracts";
import { ObjectiveFields } from "./ObjectiveFields";
import { saveCompass, type SaveResult } from "./actions";
import { emptyDraft, fromCompass, toCompass, type CompassDraft, type Objectives } from "./draft";
import styles from "./edit.module.css";

type Props = { slug: string; showName: string; compass: Compass | null };

/** Writing or changing a show's vision. Everything is checked against the contract on save. */
export function VisionEditor({ slug, showName, compass }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<CompassDraft>(() => (compass ? fromCompass(compass) : emptyDraft()));
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof CompassDraft>(key: K, value: CompassDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
  };

  const save = () =>
    startSaving(async () => {
      const outcome = await saveCompass(slug, toCompass(draft));
      setResult(outcome);
      if (outcome.ok) router.push(`/vision?show=${slug}`);
    });

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">{showName}</span>
        <h1 className="display">{compass ? <>Change the <em>vision</em></> : <>Write the <em>vision</em></>}</h1>
        <p className="lead">Say it the way you would say it out loud. Everything the system writes afterwards leans on these words.</p>
      </header>

      <section className={styles.block}>
        <h2 className="heading">What it is</h2>
        <Line label="In one line" value={draft.whatItIs} placeholder="The human side of Quantum Light Science, on YouTube." onChange={(v) => set("whatItIs", v)} />
        <Line label="Mission" value={draft.mission} placeholder="Help everyday people understand time, and use it to live fuller lives." onChange={(v) => set("mission", v)} />
        <Line label="How you see it" value={draft.howYouSeeIt} placeholder="Everyday science, but regal enough. Human first." onChange={(v) => set("howYouSeeIt", v)} optional />
        <Line label="Vision" value={draft.vision} placeholder="The show people turn to when they want time explained." onChange={(v) => set("vision", v)} />
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Core pillars</h2>
          <span className="quiet">Up to six. Everything you make should sit under one.</span>
        </div>
        <div className={styles.pillars}>
          {draft.pillars.map((pillar, i) => (
            <div key={i} className={styles.pillarRow}>
              <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)", flex: "0 0 24px" }}>{String(i + 1).padStart(2, "0")}</span>
              <input className={styles.input} value={pillar} placeholder="Personal growth and time" onChange={(e) => set("pillars", draft.pillars.map((p, j) => (j === i ? e.target.value : p)))} />
              {draft.pillars.length > 1 ? (
                <button type="button" className={styles.remove} aria-label={`Remove pillar ${i + 1}`} onClick={() => set("pillars", draft.pillars.filter((_, j) => j !== i))}>Remove</button>
              ) : null}
            </div>
          ))}
        </div>
        {draft.pillars.length < 6 ? (
          <button type="button" className="link-gold" style={{ alignSelf: "flex-start", background: "none", border: 0, font: "inherit", cursor: "pointer", padding: 0 }} onClick={() => set("pillars", [...draft.pillars, ""])}>
            Add a pillar
          </button>
        ) : null}
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">The main goal</h2>
          <span className="quiet">One goal, three objectives</span>
        </div>
        <Line label="The goal itself" value={draft.statement} placeholder="Become a trusted twice-weekly show for curious, time-hungry people" onChange={(v) => set("statement", v)} />
        <label className={styles.field} style={{ maxWidth: 220 }}>
          <span className="label">By when</span>
          <input type="date" className={styles.input} value={draft.by} onChange={(e) => set("by", e.target.value)} />
        </label>
        {draft.objectives.map((objective, i) => (
          <ObjectiveFields
            key={i}
            index={i}
            objective={objective}
            onChange={(next) => set("objectives", draft.objectives.map((o, j) => (j === i ? next : o)) as Objectives)}
          />
        ))}
      </section>

      {result && !result.ok ? (
        <div className={styles.problems} role="alert">
          <p style={{ margin: 0 }}>{result.message}</p>
          {result.problems.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {result.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        <a className="link-gold" href={`/vision?show=${slug}`}>Cancel</a>
      </div>
    </>
  );
}

function Line({ label, value, placeholder, onChange, optional = false }: { label: string; value: string; placeholder: string; onChange: (v: string) => void; optional?: boolean }) {
  return (
    <label className={styles.field}>
      <span className="label">{label}{optional ? <span className="quiet" style={{ textTransform: "none", letterSpacing: 0 }}> · optional</span> : null}</span>
      <textarea className={styles.textarea} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
