"use client";

import { useActionState } from "react";
import { sendLink, type LinkState } from "./actions";
import styles from "./login.module.css";

const initial: LinkState = { status: "idle", message: "" };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendLink, initial);

  if (state.status === "sent") {
    return <p className={styles.sent} role="status">{state.message}</p>;
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required className={styles.input} placeholder="you@yourstudio.com" />
      <button type="submit" className="btn-gold" disabled={pending}>{pending ? "Sending…" : "Send me a sign-in link"}</button>
      {state.status === "error" ? <p className={styles.error} role="alert">{state.message}</p> : null}
    </form>
  );
}
