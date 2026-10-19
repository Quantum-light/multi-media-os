"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BrandKit } from "@mmos/contracts";
import { Actions, Choice, Colour, Line, Problems, Word, WordList } from "@/components/Form";
import styles from "@/components/Form.module.css";
import type { SaveResult } from "@/lib/save";
import { saveBrandKit } from "./actions";
import { emptyBrandDraft, fromBrandKit, toBrandKit, unconfirmedUploads, type BrandDraft } from "./draft";

type Props = { slug: string; brandName: string; kit: BrandKit | null };

const SOURCES = [
  { value: "google" as const, label: "A Google font" },
  { value: "upload" as const, label: "A font I uploaded" },
];

const MOTIONS = [
  { value: "thread" as const, label: "Thread — one line carries through" },
  { value: "frame" as const, label: "Frame — things arrive inside an edge" },
  { value: "pulse" as const, label: "Pulse — a beat, then stillness" },
];

/** The brand kit, edited by a person. Everything the agents write afterwards obeys it. */
export function BrandEditor({ slug, brandName, kit }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<BrandDraft>(() => (kit ? fromBrandKit(kit) : emptyBrandDraft()));
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof BrandDraft>(key: K, value: BrandDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
  };

  const save = () =>
    startSaving(async () => {
      const outcome = await saveBrandKit(slug, toBrandKit(draft));
      setResult(outcome);
      if (outcome.ok) router.push(`/brand?brand=${slug}`);
    });

  const unconfirmed = unconfirmedUploads(draft);

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">{brandName}</span>
        <h1 className="display">{kit ? <>Change the <em>brand</em></> : <>Write the <em>brand</em></>}</h1>
        <p className="lead">Fonts, colours, movement and the things never to do. Every draft and every render reads this first.</p>
      </header>

      <section className={styles.block}>
        <h2 className="heading">The story</h2>
        <Line
          label="What this brand is"
          rows={3}
          value={draft.story}
          placeholder="The human side of Quantum Light Science: time, explained by someone living it."
          onChange={(v) => set("story", v)}
        />
        <WordList
          label="Style words"
          hint="Up to eight. The feel, in single words."
          values={draft.styleWords}
          placeholder="regal"
          max={8}
          addLabel="Add a style word"
          onChange={(v) => set("styleWords", v)}
        />
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Type</h2>
          <span className="quiet">Titles and body</span>
        </div>
        <div className={styles.pair}>
          <Word label="Display font" value={draft.displayFamily} placeholder="Instrument Serif" onChange={(v) => set("displayFamily", v)} />
          <Choice label="Where it comes from" value={draft.displaySource} options={SOURCES} onChange={(v) => set("displaySource", v)} />
        </div>
        {draft.displaySource === "upload" ? (
          <Confirm checked={draft.displayLicenceConfirmed} onChange={(v) => set("displayLicenceConfirmed", v)} />
        ) : null}
        <div className={styles.pair}>
          <Word label="Body font" value={draft.baseFamily} placeholder="Satoshi" onChange={(v) => set("baseFamily", v)} />
          <Choice label="Where it comes from" value={draft.baseSource} options={SOURCES} onChange={(v) => set("baseSource", v)} />
        </div>
        {draft.baseSource === "upload" ? (
          <Confirm checked={draft.baseLicenceConfirmed} onChange={(v) => set("baseLicenceConfirmed", v)} />
        ) : null}
        {unconfirmed.length > 0 ? (
          <p className="quiet" style={{ margin: 0 }}>
            {unconfirmed.join(" and ")} {unconfirmed.length === 1 ? "is" : "are"} uploaded. Confirm the licence above before saving.
          </p>
        ) : null}
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Colour</h2>
          <span className="quiet">Never black</span>
        </div>
        <div className={styles.trio}>
          <Colour label="Background" value={draft.ground} onChange={(v) => set("ground", v)} />
          <Colour label="Accent" value={draft.accent} onChange={(v) => set("accent", v)} />
          <Colour label="Text" value={draft.ink} onChange={(v) => set("ink", v)} />
        </div>
        <WordList
          label="Extra colours"
          hint="Up to four, as #RRGGBB"
          values={draft.extra}
          placeholder="#E6C978"
          max={4}
          addLabel="Add a colour"
          onChange={(v) => set("extra", v)}
        />
      </section>

      <section className={styles.block}>
        <h2 className="heading">Movement</h2>
        <Choice label="How it moves" value={draft.motion} options={MOTIONS} onChange={(v) => set("motion", v)} />
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Never do</h2>
          <span className="quiet">The list the agents are not allowed to cross</span>
        </div>
        <WordList
          label="Never do"
          values={draft.neverDo}
          placeholder="Never use stock footage of clocks"
          max={12}
          addLabel="Add something to never do"
          numbered
          onChange={(v) => set("neverDo", v)}
        />
      </section>

      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      <Actions saving={saving} onSave={save} cancelHref={`/brand?brand=${slug}`} />
    </>
  );
}

function Confirm({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, maxWidth: 560 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
      <span>I hold a licence to use this font in published work.</span>
    </label>
  );
}
