"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chatAction } from "./actions";
import styles from "../review.module.css";

type Turn = { role: "user" | "assistant"; text: string; edited?: string[] };

/** Ask for any change in plain words; the chat saves it as a new version and says what it did. */
export function Chat({ episodeId, ready }: { episodeId: string; ready: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = () => {
    const text = draft.trim();
    if (!text || pending) return;
    const next: Turn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setDraft("");
    start(async () => {
      const r = await chatAction(episodeId, next.map(({ role, text: t }) => ({ role, text: t })));
      setTurns((t) => [...t, { role: "assistant", text: r.reply, edited: r.edited }]);
      if (r.edited.length) router.refresh();
    });
  };

  return (
    <section className={`${styles.chat} glass`} aria-labelledby="chat-title">
      <h2 id="chat-title" className="heading" style={{ fontSize: 24 }}>Ask for a change</h2>
      {!ready ? <p className="quiet">The chat needs ANTHROPIC_API_KEY in the Studio settings on Vercel.</p> : null}
      <div className={styles.turns} aria-live="polite">
        {turns.length === 0 ? (
          <p className="quiet">For example: “make the title warmer”, “shorten the Threads post”, “add the line about my grandmother to the description”.</p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? styles.turnYou : styles.turnChat}>
              <span>{t.text}</span>
              {t.edited?.length ? <span className="quiet">Saved: {t.edited.join(", ")}</span> : null}
            </div>
          ))
        )}
        {pending ? <div className={styles.turnChat}><span className="quiet">Working on it</span></div> : null}
      </div>
      <form
        className={styles.chatForm}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="What should change?"
          aria-label="Ask for a change"
          disabled={!ready}
        />
        <button type="submit" className="btn-gold" disabled={!ready || pending || !draft.trim()}>Send</button>
      </form>
    </section>
  );
}
