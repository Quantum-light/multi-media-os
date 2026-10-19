"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setArchived } from "./actions";

type Props = { slug: string; archived: boolean };

/** Retiring and bringing back a style. Nothing is ever deleted. */
export function ArchiveButton({ slug, archived }: Props) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [working, start] = useTransition();

  const click = () =>
    start(async () => {
      const outcome = await setArchived(slug, !archived);
      setProblem(outcome.ok ? null : outcome.message);
      if (outcome.ok) router.refresh();
    });

  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        onClick={click}
        disabled={working}
        style={{ padding: 0, border: 0, background: "none", font: "inherit", fontSize: 12, color: "var(--ink-quiet)", cursor: "pointer" }}
      >
        {working ? "Working…" : archived ? "Bring back" : "Retire"}
      </button>
      {problem ? <span className="quiet" role="alert" style={{ color: "var(--gold-ink)" }}>{problem}</span> : null}
    </span>
  );
}
