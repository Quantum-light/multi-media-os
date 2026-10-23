"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Actions, Choice, Problems, Saved, Word } from "@/components/Form";
import formStyles from "@/components/Form.module.css";
import { ROLE_LABELS, ROLE_NOTES, ROLES, type Role } from "@/lib/data/settings.build";
import type { SaveResult } from "@/lib/save";
import { inviteSomeone } from "./actions";

const OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

/** Asking someone into the workspace: an address and what they may do. */
export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const send = () =>
    startSaving(async () => {
      const outcome = await inviteSomeone(email, role);
      setResult(outcome);
      if (outcome.ok) {
        setEmail("");
        router.refresh();
      }
    });

  return (
    <div className={formStyles.block}>
      <div className={formStyles.pair}>
        <Word label="Their email address" value={email} placeholder="name@example.com" onChange={(v) => { setEmail(v); setResult(null); }} />
        <Choice label="What they may do" value={role} options={OPTIONS} onChange={(v) => { setRole(v); setResult(null); }} />
      </div>
      <p className="quiet" style={{ margin: 0, maxWidth: 560 }}>{ROLE_NOTES[role]}.</p>

      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      {result?.ok ? <Saved>The invite is saved. Sending the email is not built yet, so pass the address on yourself for now.</Saved> : null}

      <Actions saving={saving} onSave={send} saveLabel="Send the invite" />
    </div>
  );
}
