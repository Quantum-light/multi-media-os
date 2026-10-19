"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Actions, Choice, Colour, Problems, Word } from "@/components/Form";
import styles from "@/components/Form.module.css";
import type { BrandRef, ChannelRef, ShowSetup } from "@/lib/data";
import type { SaveResult } from "@/lib/save";
import { platformName } from "@/lib/format";
import { saveShow } from "./actions";
import { describeSlots, emptyShowForm, fromShowSetup, renameShow, reslugShow, toShowSettings, type ShowFormDraft, type SlotDraft } from "./forms";

type Props = { show: ShowSetup | null; brands: BrandRef[]; channels: ChannelRef[]; brandSlug: string; timeZone: string };

const KINDS = [
  { value: "video" as const, label: "A video show" },
  { value: "podcast" as const, label: "A podcast" },
  { value: "both" as const, label: "Both — one recording, both forms" },
];

const APPROVALS = [
  { value: "review_all" as const, label: "I approve everything" },
  { value: "auto_high_score" as const, label: "Strong pieces go out on their own" },
  { value: "hands_off" as const, label: "Hands off — publish without me" },
];

const DAYS = [
  { value: "mon" as const, label: "Monday" },
  { value: "tue" as const, label: "Tuesday" },
  { value: "wed" as const, label: "Wednesday" },
  { value: "thu" as const, label: "Thursday" },
  { value: "fri" as const, label: "Friday" },
  { value: "sat" as const, label: "Saturday" },
  { value: "sun" as const, label: "Sunday" },
];

/** Adding or changing a show: its brand, its rhythm, its colours and where it posts. */
export function ShowForm({ show, brands, channels, brandSlug, timeZone }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<ShowFormDraft>(() =>
    show ? fromShowSetup(show, timeZone) : emptyShowForm(brandSlug || (brands[0]?.slug ?? ""), timeZone),
  );
  const [result, setResult] = useState<SaveResult | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof ShowFormDraft>(key: K, value: ShowFormDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setResult(null);
  };

  const change = (next: ShowFormDraft) => {
    setDraft(next);
    setResult(null);
  };

  const setSlot = (index: number, slot: SlotDraft) => set("slots", draft.slots.map((s, i) => (i === index ? slot : s)));

  const save = () =>
    startSaving(async () => {
      const outcome = await saveShow(show ? show.slug : null, toShowSettings(draft));
      setResult(outcome);
      if (outcome.ok) router.push("/shows");
    });

  if (brands.length === 0) {
    return (
      <>
        <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <span className="eyebrow">Your studio</span>
          <h1 className="display">Add a <em>show</em></h1>
        </header>
        <p className="lead">A show belongs to a brand, and there are no brands yet. Add a brand first.</p>
        <Actions saving={false} onSave={() => router.push("/shows?add=brand")} saveLabel="Add a brand" cancelHref="/shows" />
      </>
    );
  }

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <span className="eyebrow">{show ? show.name : "Your studio"}</span>
        <h1 className="display">{show ? <>Change a <em>show</em></> : <>Add a <em>show</em></>}</h1>
        <p className="lead">A show has its own look, its own rhythm and its own channels. Its vision and goals are written separately.</p>
      </header>

      <section className={styles.block}>
        <h2 className="heading">What it is</h2>
        <Choice label="Brand" value={draft.brandSlug} options={brands.map((b) => ({ value: b.slug, label: b.name }))} onChange={(v) => set("brandSlug", v)} />
        <div className={styles.pair}>
          <Word label="Name" value={draft.name} placeholder="Human Time with GG" onChange={(v) => change(renameShow(draft, v))} />
          <Word label="Short name" value={draft.slug} placeholder="human-time" onChange={(v) => change(reslugShow(draft, v))} />
        </div>
        <div className={styles.pair}>
          <Choice label="What kind of show" value={draft.kind} options={KINDS} onChange={(v) => set("kind", v)} />
          <Choice label="How approval works" value={draft.approvalMode} options={APPROVALS} onChange={(v) => set("approvalMode", v)} />
        </div>
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">When it goes out</h2>
          <span className="quiet">{describeSlots(draft.slots)}</span>
        </div>
        <div className={styles.rows}>
          {draft.slots.map((slot, i) => (
            <div key={i} className={styles.row}>
              <select className={styles.select} value={slot.day} onChange={(e) => setSlot(i, { ...slot, day: asDay(e.target.value) })} aria-label={`Day for slot ${i + 1}`}>
                {DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
              <input
                className={styles.input}
                value={slot.time}
                placeholder="09:00"
                aria-label={`Time for slot ${i + 1}`}
                onChange={(e) => setSlot(i, { ...slot, time: e.target.value })}
              />
              <input
                className={styles.input}
                value={slot.tz}
                placeholder="Europe/London"
                aria-label={`Time zone for slot ${i + 1}`}
                onChange={(e) => setSlot(i, { ...slot, tz: e.target.value })}
              />
              {draft.slots.length > 1 ? (
                <button type="button" className={styles.remove} aria-label={`Remove slot ${i + 1}`} onClick={() => set("slots", draft.slots.filter((_, j) => j !== i))}>
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {draft.slots.length < 14 ? (
          <button type="button" className={styles.add} onClick={() => set("slots", [...draft.slots, { day: "fri", time: "09:00", tz: timeZone }])}>
            Add a slot
          </button>
        ) : null}
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Its colours</h2>
          <span className="quiet">Never black</span>
        </div>
        <div className={styles.trio}>
          <Colour label="Background" value={draft.ground} onChange={(v) => set("ground", v)} />
          <Colour label="Accent" value={draft.accent} onChange={(v) => set("accent", v)} />
          <Colour label="Text" value={draft.ink} onChange={(v) => set("ink", v)} />
        </div>
      </section>

      <section className={styles.block}>
        <div className="section-head">
          <h2 className="heading">Where it posts</h2>
          <span className="quiet">{draft.channelIds.length === 0 ? "None chosen" : `${draft.channelIds.length} chosen`}</span>
        </div>
        {channels.length === 0 ? (
          <p className="quiet" style={{ margin: 0 }}>No channels yet. Add one and come back — a show is happy to exist without them.</p>
        ) : (
          <div className={styles.rows}>
            {channels.map((channel) => (
              <label key={channel.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={draft.channelIds.includes(channel.id)}
                  onChange={(e) =>
                    set("channelIds", e.target.checked ? [...draft.channelIds, channel.id] : draft.channelIds.filter((id) => id !== channel.id))
                  }
                />
                <span>{platformName(channel.platform)} {channel.handle}</span>
                {channel.status === "connected" ? null : <span className="quiet">· not connected</span>}
              </label>
            ))}
          </div>
        )}
      </section>

      {result && !result.ok ? <Problems message={result.message} problems={result.problems} /> : null}
      <Actions saving={saving} onSave={save} cancelHref="/shows" saveLabel={show ? "Save" : "Add the show"} />
    </>
  );
}

function asDay(value: string): SlotDraft["day"] {
  const found = DAYS.find((day) => day.value === value);
  return found ? found.value : "mon";
}
