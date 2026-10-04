import { safeNext } from "@/lib/format";
import { supabaseEnv, MISSING_ENV } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata = { title: "Sign in · multi-media os" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const configured = supabaseEnv() !== null;

  return (
    <main className={styles.page}>
      <section className={`${styles.card} glass`} aria-labelledby="sign-in">
        <div className={styles.wordmark}>
          <span>multi-media</span>
          <span className={styles.os}>os</span>
        </div>
        <h1 id="sign-in" className="display" style={{ fontSize: 44 }}>Welcome <em>back</em></h1>
        <p className="lead" style={{ margin: 0 }}>One studio for every podcast and video show you make.</p>
        {params.error === "link" ? <p className={styles.error} role="alert">That link has expired or was already used. Send a new one.</p> : null}
        {configured ? <LoginForm next={safeNext(params.next)} /> : <p className={styles.error}>{MISSING_ENV}</p>}
      </section>
    </main>
  );
}
