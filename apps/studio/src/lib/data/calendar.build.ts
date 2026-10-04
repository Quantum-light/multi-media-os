import { dayKey, platformName } from "@/lib/format";

export type CalendarPost = { show: string; platform: string; time: string; status: string; accent: string | null };
export type CalendarDay = { key: string; day: number; inMonth: boolean; isToday: boolean; anchors: string[]; posts: CalendarPost[] };
export type CalendarData = {
  month: string;
  monthLabel: string;
  prev: string;
  next: string;
  weeks: CalendarDay[][];
  shows: { name: string; accent: string | null }[];
  anchorsThisMonth: { name: string; key: string }[];
  postCount: number;
};

export type CalendarRows = {
  shows: { id: string; name: string; theme: unknown }[];
  posts: { scheduled_for: string; platform: string; status: string; show_id: string | null }[];
  anchors: { name: string; date: string; recurrence: string }[];
};

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-10" from a query value, or the current month in the time zone. */
export function monthOf(value: string | undefined, now: Date, timeZone: string): string {
  if (value && MONTH_RE.test(value)) return value;
  return dayKey(now, timeZone).slice(0, 7);
}

/** The window of instants to fetch posts for: the month plus a day either side for time zones. */
export function monthWindow(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { from: new Date(Date.UTC(y, m - 1, 0)).toISOString(), to: new Date(Date.UTC(y, m, 2)).toISOString() };
}

/** A Monday-first month grid with posts and time anchors placed on their local days. Pure and tested. */
export function buildCalendar(rows: CalendarRows, month: string, now: Date, timeZone: string): CalendarData {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const today = dayKey(now, timeZone);
  const showById = new Map(rows.shows.map((s) => [s.id, { name: s.name, accent: accentOf(s.theme) }]));
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });

  const postsByDay = new Map<string, CalendarPost[]>();
  for (const p of rows.posts) {
    const when = new Date(p.scheduled_for);
    const key = dayKey(when, timeZone);
    const show = (p.show_id ? showById.get(p.show_id) : undefined) ?? { name: "A show", accent: null };
    const list = postsByDay.get(key) ?? [];
    list.push({ show: show.name, platform: platformName(p.platform), time: time.format(when), status: p.status, accent: show.accent });
    postsByDay.set(key, list);
  }
  for (const list of postsByDay.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const anchorsByDay = new Map<string, string[]>();
  for (const a of rows.anchors) {
    const key = a.recurrence === "yearly" ? `${y}-${a.date.slice(5)}` : a.date;
    anchorsByDay.set(key, [...(anchorsByDay.get(key) ?? []), a.name]);
  }

  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells; i++) {
    const date = new Date(Date.UTC(y, m - 1, 1 - offset + i));
    const key = date.toISOString().slice(0, 10);
    const day: CalendarDay = {
      key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === m - 1,
      isToday: key === today,
      anchors: anchorsByDay.get(key) ?? [],
      posts: postsByDay.get(key) ?? [],
    };
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push(day);
  }

  const inMonth = weeks.flat().filter((d) => d.inMonth);
  return {
    month,
    monthLabel: first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    prev: shift(y, m, -1),
    next: shift(y, m, 1),
    weeks,
    shows: [...showById.values()],
    anchorsThisMonth: inMonth.flatMap((d) => d.anchors.map((name) => ({ name, key: d.key }))),
    postCount: inMonth.reduce((n, d) => n + d.posts.length, 0),
  };
}

function shift(y: number, m: number, by: number): string {
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

function accentOf(theme: unknown): string | null {
  if (theme && typeof theme === "object" && "accent" in theme) {
    const a = (theme as { accent: unknown }).accent;
    if (typeof a === "string" && /^#[0-9a-fA-F]{6}$/.test(a)) return a;
  }
  return null;
}
