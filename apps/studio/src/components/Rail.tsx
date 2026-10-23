"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Rail.module.css";

type Item = { href: string; label: string; badge?: string };
type Group = { label?: string; items: Item[] };

// Pages not built yet stay out of the rail (anti-clunk rule 9: nothing half-built on main).
const GROUPS: Group[] = [
  {
    items: [
      { href: "/", label: "Today" },
      { href: "/upload", label: "Upload" },
      { href: "/review", label: "Review" },
      { href: "/episodes", label: "Episodes" },
    ],
  },
  { label: "Plan", items: [{ href: "/calendar", label: "Calendar" }] },
  {
    label: "Studio",
    items: [
      { href: "/shows", label: "Brands and shows" },
      { href: "/vision", label: "Vision and goals" },
      { href: "/brand", label: "Brand and style" },
      { href: "/brand/styles", label: "Style Studio" },
    ],
  },
];

type Props = { workspaceName: string; mark: string; meta: string; userEmail: string };

export function Rail({ workspaceName, mark, meta, userEmail }: Props) {
  const pathname = usePathname();
  const here = currentHref(pathname);
  return (
    <nav aria-label="Studio" className={`${styles.rail} glass`}>
      <div className={styles.wordmark}>
        <span className={styles.word}>multi-media</span>
        <span className={styles.os}>os</span>
      </div>

      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">{mark}</span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>{workspaceName}</span>
          <span className={styles.brandMeta}>{meta}</span>
        </span>
      </div>

      <span className={styles.rule} aria-hidden="true" />

      {GROUPS.map((group, i) => (
        <div key={group.label ?? i} className={styles.group}>
          {group.label ? <span className={styles.groupLabel}>{group.label}</span> : null}
          {group.items.map((item) => {
            const current = item.href === here;
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

      <form action="/auth/signout" method="post" className={styles.footer}>
        <span className={styles.user} title={userEmail}>{userEmail}</span>
        <button type="submit" className={styles.signOut}>Sign out</button>
      </form>
    </nav>
  );
}

/**
 * The deepest item whose path the page sits under. Longest wins, so
 * /brand/styles lights up Style Studio rather than Brand and style.
 */
function currentHref(pathname: string): string | null {
  const matches = GROUPS.flatMap((group) => group.items)
    .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length);
  return matches.length > 0 ? matches[0]!.href : null;
}
