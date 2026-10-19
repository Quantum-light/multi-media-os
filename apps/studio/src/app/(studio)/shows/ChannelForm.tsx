"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Actions, Choice, Problems, Word } from "@/components/Form";
import styles from "@/components/Form.module.css";
import type { SaveResult } from "@/lib/save";
import { saveChannel } from "./actions";
import { toChannelSettings, type ChannelFormDraft } from "./forms";

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "threads", label: "Threads" },
  { value: "x", label: "X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "podcast", label: "Podcast" },
  { value: "newsletter", label: "Newsletter" },
  { value: "website", label: "Website" },
];

const STATUSES = [
  { value: "connected" as const, label: "Connected" },
  { value: "disconnected" as const, label: "Not connected yet" },
];

/** Adding a place a show can post to. Connecting the account itself happens later. */
export function ChannelForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<ChannelFormDraft>({ platform: "youtube", handle: "", status: "disconnected" });
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof ChannelFormDraft>(key: K, value: ChannelFormDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
  };

  const save = () =>
    startSaving(async () => {
      const outcome = await saveChannel(toChannelSettings(draft));
      setResult(outcome);
      if (outcome.ok) router.push("/shows");
    });

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">Your studio</span>
        <h1 className="display">Add a <em>channel</em></h1>
        <p className="lead">A channel is one place a show posts to. Several shows can share one, and a show can post to many.</p>
      </header>

      <section className={styles.block}>
        <div className={styles.pair}>
          <Choice label="Platform" value={draft.platform} options={PLATFORMS} onChange={(v) => set("platform", v)} />
          <Word label="Handle or page name" value={draft.handle} placeholder="@humantimewithgg" onChange={(v) => set("handle", v)} />
        </div>
        <Choice label="Is it connected?" value={draft.status} options={STATUSES} onChange={(v) => set("status", v)} />
        <p className="quiet" style={{ margin: 0, maxWidth: 560 }}>
          Leave it as not connected for now. Nothing can be published until the posting service is wired up, and the Studio will say so plainly rather than failing quietly.
        </p>
      </section>

      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      <Actions saving={saving} onSave={save} cancelHref="/shows" saveLabel="Add the channel" />
    </>
  );
}
