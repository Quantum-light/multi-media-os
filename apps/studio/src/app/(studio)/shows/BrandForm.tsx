"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Actions, Problems, Word } from "@/components/Form";
import styles from "@/components/Form.module.css";
import type { BrandRef } from "@/lib/data";
import type { SaveResult } from "@/lib/save";
import { saveBrand } from "./actions";
import { renameBrand, toBrandSettings, type BrandFormDraft } from "./forms";

/** Adding a brand, or renaming one. Its fonts and colours live on Brand and style. */
export function BrandForm({ brand }: { brand: BrandRef | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<BrandFormDraft>(() =>
    brand ? { name: brand.name, slug: brand.slug, slugEdited: true } : { name: "", slug: "", slugEdited: false },
  );
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const change = (next: BrandFormDraft) => {
    setDraft(next);
    setResult(null);
  };

  const save = () =>
    startSaving(async () => {
      const outcome = await saveBrand(brand ? brand.slug : null, toBrandSettings(draft));
      setResult(outcome);
      if (outcome.ok) router.push("/shows");
    });

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Your studio</span>
        <h1 className="display">{brand ? <>Rename a <em>brand</em></> : <>Add a <em>brand</em></>}</h1>
        <p className="lead">A brand holds its own fonts, colours and voice. One account can carry several, and nothing is shared between them unless you say so.</p>
      </header>

      <section className={styles.block}>
        <div className={styles.pair}>
          <Word label="Name" value={draft.name} placeholder="Attachai" onChange={(v) => change(renameBrand(draft, v))} />
          <Word label="Short name" value={draft.slug} placeholder="attachai" onChange={(v) => change({ ...draft, slug: v, slugEdited: true })} />
        </div>
        <p className="quiet" style={{ margin: 0, maxWidth: 560 }}>
          {brand
            ? "Changing the short name changes the links that use it."
            : "Once it is saved, write its fonts and colours on Brand and style, then add its first show."}
        </p>
      </section>

      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      <Actions saving={saving} onSave={save} cancelHref="/shows" saveLabel={brand ? "Save" : "Add the brand"} />
    </>
  );
}
