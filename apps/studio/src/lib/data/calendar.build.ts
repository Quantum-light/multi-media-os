import { dayKey, platformName } from "@/lib/format";

export type CalendarPost = { show: string; platform: string; time: string; status: string; accent: string | null; themes: string[] };
export type CalendarDay = { key: string; day: number; inMonth: boolean; isToday: boolean; anchors: string[]; posts: CalendarPost[]; themes: string[] };
/** One layer a person can show or hide. `href` is this month with that layer flipped. */
export type LayerOption = { value: string; label: string; accent: string | null; count: number; on: boolean; href: string };
export type CalendarLayers = { shows: LayerOption[]; platforms: LayerOption[]; on: boolean; clearHref: string };
/** What the URL asked for. Empty means every show, or every platform. */
export type CalendarSelection = { shows: string[]; platforms: string[] };
export type CalendarData = {
  month: string;
  monthLabel: string;
  prev: string;
  next: string;
  prevHref: string;
  nextHref: string;
  thisHref: string;
  weeks: CalendarDay[][];
  shows: { name: string; accent: string | null }[];
  anchorsThisMonth: { name: string; key: string }[];
  postCount: number;
  hiddenCount: number;
  layers: CalendarLayers;
  themesThisMonth: { name: string; count: number }[];
};

export type CalendarRows = {
  shows: { id: string; name: string; theme: unknown; slug?: string }[];
  posts: { scheduled_for: string; platform: string; status: string; show_id: string | null; episode_id?: string | null }[];
  anchors: { name: string; date: string; recurrence: string }[];
  themes?: { id: string; name: string }[];
  edges?: { from_kind: string; from_id: string; to_kind: string; to_id: string }[];
};

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const NO_LAYERS: CalendarSelection = { shows: [], platforms: [] };

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

/** One layer parameter, either "?show=a,b" or the same name given twice. */
export function parseLayer(value: string | string[] | undefined): string[] {
  const given = Array.isArray(value) ? value : [value ?? ""];
  return [...new Set(given.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean))];
}

/** The layers the URL asked for, so a view can be shared and the back button works. */
export function selectionFrom(params: { show?: string | string[] | undefined; platform?: string | string[] | undefined }): CalendarSelection {
  return { shows: parseLayer(params.show), platforms: parseLayer(params.platform) };
}

/** The address of a month with these layers showing. */
export function calendarHref(month: string, selection: CalendarSelection): string {
  const query = new URLSearchParams({ month });
  if (selection.shows.length > 0) query.set("show", selection.shows.join(","));
  if (selection.platforms.length > 0) query.set("platform", selection.platforms.join(","));
  return `/calendar?${query.toString()}`;
}

/** A Monday-first month grid with posts, themes and time anchors on their local days. Pure and tested. */
export function buildCalendar(rows: CalendarRows, month: string, now: Date, timeZone: string, selection: CalendarSelection = NO_LAYERS): CalendarData {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const today = dayKey(now, timeZone);
  const showById = new Map(rows.shows.map((s) => [s.id, { name: s.name, slug: s.slug ?? s.id, accent: accentOf(s.theme) }]));
  const themesByEpisode = themeLinks(rows);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });

  const placed = rows.posts.map((p) => {
    const when = new Date(p.scheduled_for);
    const show = (p.show_id ? showById.get(p.show_id) : undefined) ?? { name: "A show", slug: "", accent: null };
    const themes = (p.episode_id ? themesByEpisode.get(p.episode_id) : undefined) ?? [];
    return {
      key: dayKey(when, timeZone),
      showSlug: show.slug,
      platform: p.platform,
      post: { show: show.name, platform: platformName(p.platform), time: time.format(when), status: p.status, accent: show.accent, themes },
    };
  });

  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const dates = Array.from({ length: cells }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - offset + i)));
  const monthKeys = new Set(dates.filter((d) => d.getUTCMonth() === m - 1).map((d) => d.toISOString().slice(0, 10)));

  const thisMonth = placed.filter((p) => monthKeys.has(p.key));
  const chosen = (p: { showSlug: string; platform: string }) =>
    (selection.shows.length === 0 || selection.shows.includes(p.showSlug)) &&
    (selection.platforms.length === 0 || selection.platforms.includes(p.platform));
  const shown = placed.filter(chosen);

  const postsByDay = new Map<string, CalendarPost[]>();
  for (const p of shown) postsByDay.set(p.key, [...(postsByDay.get(p.key) ?? []), p.post]);
  for (const list of postsByDay.values()) list.sort((a, b) => a.time.localeCompare(b.time));

  const anchorsByDay = new Map<string, string[]>();
  for (const a of rows.anchors) {
    const key = a.recurrence === "yearly" ? `${y}-${a.date.slice(5)}` : a.date;
    anchorsByDay.set(key, [...(anchorsByDay.get(key) ?? []), a.name]);
  }

  const weeks: CalendarDay[][] = [];
  dates.forEach((date, i) => {
    const key = date.toISOString().slice(0, 10);
    const posts = postsByDay.get(key) ?? [];
    const day: CalendarDay = {
      key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === m - 1,
      isToday: key === today,
      anchors: anchorsByDay.get(key) ?? [],
      posts,
      themes: [...new Set(posts.flatMap((p) => p.themes))],
    };
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1]!.push(day);
  });

  const inMonth = weeks.flat().filter((d) => d.inMonth);
  return {
    month,
    monthLabel: first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    prev: shift(y, m, -1),
    next: shift(y, m, 1),
    prevHref: calendarHref(shift(y, m, -1), selection),
    nextHref: calendarHref(shift(y, m, 1), selection),
    thisHref: calendarHref(dayKey(now, timeZone).slice(0, 7), selection),
    weeks,
    shows: [...showById.values()].map((s) => ({ name: s.name, accent: s.accent })),
    anchorsThisMonth: inMonth.flatMap((d) => d.anchors.map((name) => ({ name, key: d.key }))),
    postCount: inMonth.reduce((n, d) => n + d.posts.length, 0),
    hiddenCount: thisMonth.length - thisMonth.filter(chosen).length,
    layers: layersOf(rows, thisMonth, month, selection),
    themesThisMonth: tallied(inMonth.flatMap((d) => d.posts.flatMap((p) => p.themes))),
  };
}

type Placed = { showSlug: string; platform: string };

/** The chips: every show, and every platform this month uses or the URL asks for. */
function layersOf(rows: CalendarRows, thisMonth: Placed[], month: string, selection: CalendarSelection): CalendarLayers {
  const showCounts = counts(thisMonth.map((p) => p.showSlug));
  const platformCounts = counts(thisMonth.map((p) => p.platform));
  const platforms = [...new Set([...platformCounts.keys(), ...selection.platforms])].sort((a, b) => platformName(a).localeCompare(platformName(b)));
  return {
    shows: rows.shows.map((s) => {
      const value = s.slug ?? s.id;
      return option("shows", value, s.name, accentOf(s.theme), showCounts.get(value) ?? 0, month, selection);
    }),
    platforms: platforms.map((p) => option("platforms", p, platformName(p), null, platformCounts.get(p) ?? 0, month, selection)),
    on: selection.shows.length > 0 || selection.platforms.length > 0,
    clearHref: calendarHref(month, { shows: [], platforms: [] }),
  };
}

function option(kind: keyof CalendarSelection, value: string, label: string, accent: string | null, count: number, month: string, selection: CalendarSelection): LayerOption {
  const chosen = selection[kind];
  const on = chosen.includes(value);
  const next = { ...selection, [kind]: on ? chosen.filter((v) => v !== value) : [...chosen, value] };
  return { value, label, accent, count, on, href: calendarHref(month, next) };
}

/** Episode id to the names of the themes it belongs to, from the edges the understand step writes. */
function themeLinks(rows: CalendarRows): Map<string, string[]> {
  const names = new Map((rows.themes ?? []).map((t) => [t.id, t.name]));
  const byEpisode = new Map<string, string[]>();
  for (const e of rows.edges ?? []) {
    const episode = e.from_kind === "episode" ? e.from_id : e.to_kind === "episode" ? e.to_id : null;
    const theme = e.to_kind === "theme" ? e.to_id : e.from_kind === "theme" ? e.from_id : null;
    const name = theme ? names.get(theme) : undefined;
    if (!episode || !name) continue;
    const list = byEpisode.get(episode) ?? [];
    if (!list.includes(name)) byEpisode.set(episode, [...list, name]);
  }
  return byEpisode;
}

function counts(values: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
  return out;
}

/** Most used first, then alphabetical, so the order never wobbles. */
function tallied(values: string[]): { name: string; count: number }[] {
  return [...counts(values)].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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
