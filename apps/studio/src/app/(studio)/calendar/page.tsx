import Link from "next/link";
import { getCalendar } from "@/lib/data";
import styles from "./calendar.module.css";

export const metadata = { title: "Calendar · multi-media os" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS: Record<string, string> = { waiting_review: "waiting for review", scheduled: "scheduled", published: "live", failed: "failed" };

type Props = { searchParams: Promise<{ month?: string }> };

export default async function CalendarPage({ searchParams }: Props) {
  const { month } = await searchParams;
  const data = await getCalendar(month);
  if (!data) return null;

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}>
          <span className="eyebrow">Calendar</span>
          <h1 className="display">{data.monthLabel}</h1>
          <p className="lead">
            {data.postCount === 0 ? "Nothing scheduled this month yet." : `${data.postCount} ${data.postCount === 1 ? "post" : "posts"} this month.`}
            {data.anchorsThisMonth.length > 0 ? ` ${data.anchorsThisMonth.length} ${data.anchorsThisMonth.length === 1 ? "moment" : "moments"} in time to plan around.` : ""}
          </p>
        </div>
        <nav aria-label="Months" style={{ display: "flex", gap: 8 }}>
          <Link className="chip" href={`/calendar?month=${data.prev}`} aria-label="Previous month">←</Link>
          <Link className="chip" href="/calendar">This month</Link>
          <Link className="chip" href={`/calendar?month=${data.next}`} aria-label="Next month">→</Link>
        </nav>
      </header>

      <div className={styles.scroller}>
        <div className={styles.grid}>
          {WEEKDAYS.map((d) => (
            <span key={d} className={`label ${styles.weekday}`}>{d}</span>
          ))}
          {data.weeks.flat().map((day) => (
            <div key={day.key} className={[styles.cell, day.inMonth ? "" : styles.outside, day.isToday ? styles.today : ""].join(" ")}>
              <span className={`figure ${styles.number}`}>{day.day}</span>
              {day.anchors.map((a) => (
                <span key={a} className={styles.anchor}>{a}</span>
              ))}
              {day.posts.map((p, i) => (
                <span key={`${p.time}-${p.platform}-${i}`} className={styles.post} title={`${p.show} · ${p.platform} · ${STATUS[p.status] ?? p.status}`}>
                  <span aria-hidden="true" className={styles.dot} style={p.accent ? { background: p.accent } : undefined} />
                  <span className="figure">{p.time}</span> {p.platform}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {data.shows.length > 0 ? (
        <p className="quiet" style={{ display: "flex", flexWrap: "wrap", gap: 18, margin: 0 }}>
          {data.shows.map((s) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" className={styles.dot} style={s.accent ? { background: s.accent } : undefined} />
              {s.name}
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" className={styles.anchorKey} />
            Moments in time
          </span>
        </p>
      ) : null}
    </>
  );
}
