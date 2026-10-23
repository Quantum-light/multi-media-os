"use client";

import { useState, useTransition } from "react";
import { Choice, Line, Problems } from "@/components/Form";
import type { PlanIdea } from "@/lib/data/plan.build";
import type { SaveResult } from "@/lib/save";
import { dropIdea, saveIdea } from "./actions";
import styles from "./plan.module.css";

type FormProps = {
  showSlug: string;
  pillars: string[];
  /** The slot this idea answers, or null to write one with no slot yet. */
  slotAt: string | null;
  /** What the button says when the form is closed. */
  openLabel: string;
};

/** A line of her own words against one slot, and the pillar it serves. */
export function IdeaForm({ showSlug, pillars, slotAt, openLabel }: FormProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pillar, setPillar] = useState(pillars[0] ?? "");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  if (pillars.length === 0) {
    return <span className="quiet">Write this show&rsquo;s pillars on Vision and goals first, so an idea has something to serve.</span>;
  }

  if (!open) {
    return (
      <button type="button" className={styles.write} onClick={() => setOpen(true)}>
        {openLabel}
      </button>
    );
  }

  const save = () =>
    startSaving(async () => {
      const outcome = await saveIdea({ showSlug, pillar, body, slotAt });
      setResult(outcome);
      if (outcome.ok) {
        setBody("");
        setOpen(false);
      }
    });

  return (
    <div className={styles.form}>
      <Line
        label="Your idea"
        value={body}
        placeholder="In your own words. Name the thing of yours it comes from."
        rows={2}
        onChange={(v) => {
          setBody(v);
          setResult(null);
        }}
      />
      <Choice
        label="Pillar it serves"
        value={pillar}
        options={pillars.map((p) => ({ value: p, label: p }))}
        onChange={(v) => setPillar(v)}
      />
      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      <div className={styles.formActions}>
        <button type="button" className="btn-gold" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Keep this idea"}
        </button>
        <button type="button" className={styles.write} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** One kept idea, with the pillar it serves and a way to let it go. */
export function IdeaLine({ idea }: { idea: PlanIdea }) {
  const [result, setResult] = useState<SaveResult | null>(null);
  const [dropping, startDropping] = useTransition();

  return (
    <div className={styles.idea}>
      <span className={styles.ideaBody}>{idea.body}</span>
      <span className={styles.ideaFoot}>
        <span className="label">{idea.pillar}</span>
        <button
          type="button"
          className={styles.write}
          disabled={dropping}
          onClick={() => startDropping(async () => setResult(await dropIdea(idea.id)))}
        >
          {dropping ? "Dropping…" : "Drop"}
        </button>
      </span>
      {result && !result.ok ? <span className="quiet">{result.message}</span> : null}
    </div>
  );
}
