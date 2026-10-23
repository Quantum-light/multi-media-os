"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revokeInvite } from "./actions";
import styles from "./settings.module.css";

/** Taking back one invite that nobody has accepted. */
export function RevokeInvite({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [working, startWorking] = useTransition();

  const revoke = () =>
    startWorking(async () => {
      const outcome = await revokeInvite(id);
      setProblem(outcome.ok ? null : outcome.message);
      if (outcome.ok) router.refresh();
    });

  return (
    <span className={styles.revoke}>
      <button
        type="button"
        className={styles.revokeButton}
        aria-label={`Take back the invite to ${email}`}
        onClick={revoke}
        disabled={working}
      >
        {working ? "Taking it back…" : "Take it back"}
      </button>
      {problem ? <span className="quiet" role="alert">{problem}</span> : null}
    </span>
  );
}
