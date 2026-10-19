"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Actions, Choice, Line, Problems, Word, WordList } from "@/components/Form";
import styles from "@/components/Form.module.css";
import type { StyleCard } from "@/lib/data";
import type { SaveResult } from "@/lib/save";
import { saveStyle } from "./actions";
import { emptyStyleDraft, fromStyleCard, rename, reslug, toStyleDoc, type StyleDraft } from "./draft";

type Props = { card: StyleCard | null; brands: { slug: string; name: string }[]; brandSlug: string };

const KINDS = [
  { value: "video" as const, label: "Video — how a cut looks and moves" },
  { value: "image" as const, label: "Image — thumbnails and stills" },
  { value: "motion" as const, label: "Motion — titles and transitions" },
  { value: "voice" as const, label: "Voice — how the words sound" },
];

const ASPECTS = [
  { value: "" as const, label: "Any shape" },
  { value: "16:9" as const, label: "16:9 — wide" },
  { value: "9:16" as const, label: "9:16 — upright" },
  { value: "1:1" as const, label: "1:1 — square" },
  { value: "4:5" as const, label: "4:5 — tall" },
];

const PACES = [
  { value: "" as const, label: "No set pace" },
  { value: "slow" as const, label: "Slow — let shots breathe" },
  { value: "steady" as const, label: "Steady" },
  { value: "quick" as const, label: "Quick — cut on the beat" },
];

const CAPTIONS = [
  { value: "" as const, label: "Not part of this style" },
  { value: "on" as const, label: "Captions on" },
  { value: "off" as const, label: "Captions off" },
];

const POSITIONS = [
  { value: "bottom" as const, label: "At the bottom" },
  { value: "middle" as const, label: "Across the middle" },
  { value: "top" as const, label: "At the top" },
];

/** Writing a style: a name, when to reach for it, and the instruction itself. */
export function StyleEditor({ card, brands, brandSlug }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<StyleDraft>(() => (card ? fromStyleCard(card) : emptyStyleDraft(brandSlug)));
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof StyleDraft>(key: K, value: StyleDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
  };

  const change = (next: StyleDraft) => {
    setDraft(next);
    setResult(null);
  };

  const save = () =>
    startSaving(async () => {
      const outcome = await saveStyle(card ? card.slug : null, draft.brandSlug, toStyleDoc(draft));
      setResult(outcome);
      if (outcome.ok) router.push("/brand/styles");
    });

  const scope = [{ value: "", label: "Every brand in this workspace" }, ...brands.map((b) => ({ value: b.slug, label: b.name }))];

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Style Studio</span>
        <h1 className="display">{card ? <>Change a <em>style</em></> : <>Save a <em>style</em></>}</h1>
        <p className="lead">Write it once, the way you would explain it to an editor. After this you apply it by name.</p>
      </header>

      <section className={styles.block}>
        <h2 className="heading">What it is</h2>
        <div className={styles.pair}>
          <Word label="Name" value={draft.name} placeholder="How I open an episode" onChange={(v) => change(rename(draft, v))} />
          <Word label="Short name" value={draft.slug} placeholder="how-i-open-an-episode" onChange={(v) => change(reslug(draft, v))} />
        </div>
        <Choice label="What it styles" value={draft.kind} options={KINDS} onChange={(v) => set("kind", v)} />
        <Choice label="Who can use it" value={draft.brandSlug} options={scope} onChange={(v) => set("brandSlug", v)} />
        <Line
          label="When to use it"
          value={draft.useWhen}
          placeholder="The first twenty seconds of a full episode, never a short."
          onChange={(v) => set("useWhen", v)}
          optional
        />
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">The instruction</h2>
          <span className="quiet">In your words, not settings</span>
        </div>
        <Line
          label="The style itself"
          rows={6}
          value={draft.prompt}
          placeholder="Hold on my face for two beats before the first cut. No music until I have spoken. Warm grade, a little grain, nothing glossy."
          onChange={(v) => set("prompt", v)}
        />
        <WordList
          label="Never do"
          hint="Things this style rules out"
          values={draft.neverDo}
          placeholder="No zoom on the first cut"
          max={12}
          addLabel="Add something to never do"
          numbered
          onChange={(v) => set("neverDo", v)}
        />
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Settings</h2>
          <span className="quiet">Optional. Leave them alone and the instruction decides.</span>
        </div>
        <div className={styles.pair}>
          <Choice label="Shape" value={draft.aspect} options={ASPECTS} onChange={(v) => set("aspect", v)} />
          <Choice label="Pace" value={draft.pace} options={PACES} onChange={(v) => set("pace", v)} />
        </div>
        <div className={styles.pair}>
          <Choice label="Captions" value={draft.captions} options={CAPTIONS} onChange={(v) => set("captions", v)} />
          {draft.captions === "on" ? (
            <Choice label="Where" value={draft.captionPosition} options={POSITIONS} onChange={(v) => set("captionPosition", v)} />
          ) : null}
        </div>
        <WordList
          label="Colours"
          hint="Up to six, as #RRGGBB"
          values={draft.palette}
          placeholder="#C9A24A"
          max={6}
          addLabel="Add a colour"
          onChange={(v) => set("palette", v)}
        />
      </section>

      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      <Actions saving={saving} onSave={save} cancelHref="/brand/styles" saveLabel={card ? "Save" : "Save the style"} />
    </>
  );
}
