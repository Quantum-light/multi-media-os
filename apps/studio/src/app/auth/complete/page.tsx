import { safeNext } from "@/lib/format";
import { Complete } from "./Complete";
import styles from "../../login/login.module.css";

export const metadata = { title: "Signing in · multi-media os" };

type Props = { searchParams: Promise<{ next?: string }> };

/** Finishes sign-in from a link whose session arrives in the URL fragment. */
export default async function CompletePage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <main className={styles.page}>
      <section className={`${styles.card} glass`} aria-live="polite">
        <Complete next={safeNext(next)} />
      </section>
    </main>
  );
}
