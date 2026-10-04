"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Rail.module.css";

type Item = { href: string; label: string; badge?: string };
type Group = { label?: string; items: Item[] };

// Pages not built yet stay out of the rail (anti-clunk rule 9: nothing half-built on main).
const GROUPS: Group[] = [
  { items: [{ href: "/", label: "Today" }, { href: "/vision", label: "Vision and goals" }] },
];

export function Rail() {
  const pathname = usePathname();
  return (
    <nav aria-label="Studio" className={`${styles.rail} glass`}>
      <div className={styles.wordmark}>
        <span className={styles.word}>multi-media</span>
        <span className={styles.os}>os</span>
      </div>

      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">QLS</span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>Quantum Light Science</span>
          <span className={styles.brandMeta}>2 shows</span>
        </span>
      </div>

      <span className={styles.rule} aria-hidden="true" />

      {GROUPS.map((group, i) => (
        <div key={group.label ?? i} className={styles.group}>
          {group.label ? <span className={styles.groupLabel}>{group.label}</span> : null}
          {group.items.map((item) => {
            const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={current ? styles.itemCurrent : styles.item}>
                <span className={current ? styles.dotOn : styles.dot} aria-hidden="true" />
                <span className={styles.itemLabel}>{item.label}</span>
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
