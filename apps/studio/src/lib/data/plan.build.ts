import { dayKey, platformName } from "@/lib/format";
import { rhythmOf } from "./shows.build";

/** An idea in the person's own words, against a slot and a pillar. */
export type PlanIdea = { id: string; body: string; pillar: string; state: string; slotAt: string | null };

/** What is already heading for a slot. */
export type PlanFill = { label: string; status: string; at: string };

export type PlanSlot = {
  /** Stable across renders: the show and the instant. */
  key: string;
  /** The instant the slot falls on, as ISO. This is what an idea stores in slot_at. */
  at: string;
  day: string;
  dayLabel: string;
  time: string;
  fill: PlanFill | null;
  ideas: PlanIdea[];
};

export type PlanWeek = { start: string; label: string; thisWeek: boolean; anchors: string[]; slots: PlanSlot[]; empty: number };

export type PlanShowBoard = {
  slug: string;
  name: string;
  accent: string | null;
  /** The pillars of this show's compass. Empty when no vision is written yet. */
  pillars: string[];
  rhythm: string;
  weeks: PlanWeek[];
  slotCount: number;
  empty: number;
  /** How many ideas stand against each pillar in this window, so a neglected pillar shows. */
  pillarCounts: { pillar: string; ideas: number }[];
  /** Ideas for this show with no slot, or a slot outside the window. */
  loose: PlanIdea[];
};

export type PlanData = {
  weeks: number;
  from: string;
  to: string;
  timeZone: string;
  shows: PlanShowBoard[];
  slotCount: number;
  empty: number;
};

export type PlanRows = {
  shows: { id: string; slug: string; name: string; theme: unknown; slots: unknown; compass: unknown }[];
  posts: { scheduled_for: string; platform: string; status: string; show_id: string | null }[];
  ideas: { id: string; show_id: string; pillar: string; body: string; slot_at: string | null; state: string }[];
  anchors: { name: string; date: string; recurrence: string }[];
};

export type PlanWindow = { from: string; to: string; weekStarts: string[] };

const DAY_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
const MS_DAY = 86_400_000;
/** A post this far from a slot is taken to be that slot's post. Half a day either way. */
const NEAR_MS = 12 * 60 * 60 * 1000;
const WEEKS_MIN = 1;
const WEEKS_MAX = 8;
const WEEKS_DEFAULT = 4;

/** How many weeks ahead to show. Anything odd falls back to four. */
export function weeksAheadOf(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(n) || n < WEEKS_MIN || n > WEEKS_MAX) return WEEKS_DEFAULT;
  return n;
}

/**
 * The window the board covers: from now to the end of the last whole week,
 * counting weeks from the Monday of the week we are in. Slots that have
 * already passed are not questions, so the window starts at now.
 */
export function planWindow(now: Date, weeks: number, timeZone: string): PlanWindow {
  const monday = mondayOf(dayKey(now, timeZone));
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(monday, i * 7));
  const end = addDays(monday, weeks * 7);
  return { from: now.toISOString(), to: `${end}T00:00:00.000Z`, weekStarts };
}

/** The window to fetch posts over: a day either side, so no time zone loses one. */
export function postWindow(window: PlanWindow): { from: string; to: string } {
  return {
    from: new Date(new Date(window.from).getTime() - MS_DAY).toISOString(),
    to: new Date(new Date(window.to).getTime() + MS_DAY).toISOString(),
  };
}

/** The instant a local day and time fall on in a time zone, over a DST change too. */
export function zonedInstant(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let guess = naive - offsetMs(new Date(naive), timeZone);
  guess = naive - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/**
 * The board. One section per show, one block per week, every posting slot in
 * the window either filled or empty, with the person's ideas against it.
 * Pure, so the slot maths can be tested without a database.
 */
export function buildPlan(rows: PlanRows, window: PlanWindow, now: Date, timeZone: string): PlanData {
  const anchorsByDay = anchorDays(rows.anchors, window.weekStarts);
  const postsByShow = groupBy(rows.posts, (p) => p.show_id ?? "");
  const ideasByShow = groupBy(
    rows.ideas.filter((i) => i.state !== "dropped"),
    (i) => i.show_id,
  );

  const thisWeek = mondayOf(dayKey(now, timeZone));

  const shows = rows.shows.map((show) => {
    const slots = slotsOf(show.slots);
    const weeks = window.weekStarts.map((start) => {
      const placed = slotsInWeek(slots, start, window, show.slug);
      return {
        start,
        label: weekLabel(start),
        thisWeek: start === thisWeek,
        anchors: anchorsByDay.get(start) ?? [],
        slots: placed,
        empty: 0,
      };
    });

    const all = weeks.flatMap((w) => w.slots);
    fillFromPosts(all, postsByShow.get(show.id) ?? []);
    const loose = attachIdeas(all, ideasByShow.get(show.id) ?? []);
    for (const week of weeks) week.empty = week.slots.filter((s) => s.fill === null && s.ideas.length === 0).length;

    const pillars = pillarsOf(show.compass);
    const counted = all.flatMap((s) => s.ideas).concat(loose);
    return {
      slug: show.slug,
      name: show.name,
      accent: accentOf(show.theme),
      pillars,
      rhythm: rhythmOf(show.slots),
      weeks,
      slotCount: all.length,
      empty: all.filter((s) => s.fill === null && s.ideas.length === 0).length,
      pillarCounts: pillars.map((pillar) => ({ pillar, ideas: counted.filter((i) => i.pillar === pillar).length })),
      loose,
    };
  });

  return {
    weeks: window.weekStarts.length,
    from: window.from,
    to: window.to,
    timeZone,
    shows,
    slotCount: shows.reduce((n, s) => n + s.slotCount, 0),
    empty: shows.reduce((n, s) => n + s.empty, 0),
  };
}

type Slot = { day: string; time: string; tz: string };

function slotsOf(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const day = typeof s["day"] === "string" ? s["day"] : "";
    const time = typeof s["time"] === "string" ? s["time"] : "";
    if (!(day in DAY_INDEX) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
    return [{ day, time, tz: typeof s["tz"] === "string" && s["tz"] !== "" ? s["tz"] : "UTC" }];
  });
}

/** Every slot of one week that still lies inside the window, in time order. */
function slotsInWeek(slots: Slot[], weekStart: string, window: PlanWindow, showSlug: string): PlanSlot[] {
  const from = new Date(window.from).getTime();
  const to = new Date(window.to).getTime();
  return slots
    .flatMap((slot) => {
      const day = addDays(weekStart, DAY_INDEX[slot.day]!);
      const at = zonedInstant(day, slot.time, slot.tz);
      if (at.getTime() < from || at.getTime() >= to) return [];
      return [
        {
          key: `${showSlug}-${at.toISOString()}`,
          at: at.toISOString(),
          day,
          dayLabel: dayAndDate(at, slot.tz),
          time: slot.time,
          fill: null,
          ideas: [] as PlanIdea[],
        },
      ];
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Marks the slots a post is already heading for: nearest pairing first, each
 * post used once, nothing paired more than half a day apart.
 */
function fillFromPosts(slots: PlanSlot[], posts: PlanRows["posts"]): void {
  const pairs: { s: number; p: number; d: number }[] = [];
  slots.forEach((slot, si) => {
    const at = new Date(slot.at).getTime();
    posts.forEach((post, pi) => {
      const d = Math.abs(new Date(post.scheduled_for).getTime() - at);
      if (d <= NEAR_MS) pairs.push({ s: si, p: pi, d });
    });
  });
  pairs.sort((a, b) => a.d - b.d || a.s - b.s || a.p - b.p);
  const takenSlots = new Set<number>();
  const takenPosts = new Set<number>();
  for (const pair of pairs) {
    if (takenSlots.has(pair.s) || takenPosts.has(pair.p)) continue;
    takenSlots.add(pair.s);
    takenPosts.add(pair.p);
    const post = posts[pair.p]!;
    slots[pair.s]!.fill = { label: platformName(post.platform), status: post.status, at: post.scheduled_for };
  }
}

/** Hangs each idea on its slot. Returns the ones with no slot in this window. */
function attachIdeas(slots: PlanSlot[], ideas: PlanRows["ideas"]): PlanIdea[] {
  const byInstant = new Map<number, PlanSlot>();
  for (const slot of slots) byInstant.set(new Date(slot.at).getTime(), slot);
  const loose: PlanIdea[] = [];
  for (const row of ideas) {
    const idea = { id: row.id, body: row.body, pillar: row.pillar, state: row.state, slotAt: row.slot_at };
    const slot = row.slot_at === null ? undefined : byInstant.get(new Date(row.slot_at).getTime());
    if (slot) slot.ideas.push(idea);
    else loose.push(idea);
  }
  return loose;
}

/** Time anchors landing in each week, keyed by that week's Monday. */
function anchorDays(anchors: PlanRows["anchors"], weekStarts: string[]): Map<string, string[]> {
  const byWeek = new Map<string, string[]>();
  for (const start of weekStarts) {
    const year = Number(start.slice(0, 4));
    const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    const names = anchors
      .filter((a) => days.has(a.recurrence === "yearly" ? `${year}-${a.date.slice(5)}` : a.date))
      .map((a) => a.name);
    if (names.length > 0) byWeek.set(start, names);
  }
  return byWeek;
}

export function pillarsOf(compass: unknown): string[] {
  if (!compass || typeof compass !== "object") return [];
  const value = (compass as { pillars?: unknown }).pillars;
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is string => typeof p === "string" && p.trim() !== "");
}

function accentOf(theme: unknown): string | null {
  if (theme && typeof theme === "object" && "accent" in theme) {
    const a = (theme as { accent: unknown }).accent;
    if (typeof a === "string" && /^#[0-9a-fA-F]{6}$/.test(a)) return a;
  }
  return null;
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

function addDays(day: string, by: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + by * MS_DAY).toISOString().slice(0, 10);
}

/** "Week of 26 October". */
function weekLabel(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  return `Week of ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" })}`;
}

/** "Tue 27" as the slot's own time zone sees it. */
function dayAndDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone }).format(at).replace(",", "");
}

function offsetMs(utc: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(utc.getTime() / 1000) * 1000;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}
