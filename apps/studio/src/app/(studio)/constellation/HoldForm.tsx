"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Actions, Choice, Problems, Saved } from "@/components/Form";
import formStyles from "@/components/Form.module.css";
import type { SaveResult } from "@/lib/save";
import { holdForAnchor } from "./actions";

type Option = { value: string; label: string };
type Props = { pieces: Option[]; moments: Option[] };

/** Puts one piece aside for a moment in time that has not arrived yet. */
export function HoldForm({ pieces, moments }: Props) {
  const router = useRouter();
  const [piece, setPiece] = useState(pieces[0]?.value ?? "");
  const [moment, setMoment] = useState(moments[0]?.value ?? "");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const save = () =>
    startSaving(async () => {
      const outcome = await holdForAnchor(piece, moment);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });

  return (
    <div className={formStyles.block}>
      <Choice label="What to hold" value={piece} options={pieces} onChange={(v) => { setPiece(v); setResult(null); }} />
      <Choice label="For which moment" value={moment} options={moments} onChange={(v) => { setMoment(v); setResult(null); }} />
      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      {result?.ok ? <Saved>Held. It now sits against that moment, waiting.</Saved> : null}
      <Actions saving={saving} onSave={save} saveLabel="Hold it" />
    </div>
  );
}
