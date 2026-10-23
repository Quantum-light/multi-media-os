"use client";

import { useState, useTransition } from "react";
import { approveAction } from "./actions";

/** The one Approve. Schedules every planned post; nothing is published until render and publish run (M6). */
export function Approve({ episodeId, canApprove, posts }: { episodeId: string; canApprove: boolean; posts: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!canApprove) return <p className="quiet">An owner or approver approves this episode.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <button
        type="button"
        className="btn-gold"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await approveAction(episodeId);
            if (r && !r.ok) setError(r.message);
          })
        }
      >
        {pending ? "Approving" : `Approve and schedule ${posts === 1 ? "1 post" : `${posts} posts`}`}
      </button>
      {error ? <span className="quiet" role="alert">{error}</span> : null}
    </div>
  );
}
