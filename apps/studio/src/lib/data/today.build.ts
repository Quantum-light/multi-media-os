import { dayKey, dayLabel, greeting, listJoin, plural, platformName, shortDay } from "@/lib/format";
import { isShowKind, progressOf } from "@/lib/steps";

export type ForYouItem = { id: string; kind: "review" | "attention" | "setup"; title: string; detail: string; ground: string | null };
export type StudioJob = { id: string; name: string; show: string; stepLabel: string; stepIndex: number; totalSteps: number };
export type WeekDay = { key: string; day: string; items: string };

export type TodayData = {
  dateLabel: string;
  greeting: string;
  summary: string;
  forYou: ForYouItem[];
  inStudio: StudioJob[];
  week: WeekDay[];
  healthy: boolean;
  healthNote: string;
};

export type TodayRows = {
  shows: { id: string; name: string; kind: string; theme: unknown; compass: unknown; channels: number }[];
  episodes: { id: string; title: string | null; state: string; show_id: string; created_at: string }[];
  jobs: { episode_id: string; step: string; status: string; created_at: string; lease_until: string | null }[];
  posts: { platform: string; scheduled_for: string; show_id: string | null }[];
  failedJobsThisWeek: number;
};

const RESTING = new Set(["review", "approved", "published", "failed"]);

/** Turns raw rows into the Today screen. Pure, so it is tested without a database. */
export function buildToday(rows: TodayRows, now: Date, timeZone: string): TodayData {
  const showById = new Map(rows.shows.map((s) => [s.id, s]));
  const showName = (id: string | null) => (id ? showById.get(id)?.name : undefined) ?? "A show";
  const episodeName = (e: { title: string | null; show_id: string }) => e.title ?? `New ${showName(e.show_id)} recording`;

  const ready = rows.episodes.filter((e) => e.state === "review");
  const failed = rows.episodes.filter((e) => e.state === "failed");
  const working = rows.episodes.filter((e) => !RESTING.has(e.state));

  const forYou: ForYouItem[] = [
    ...ready.map((e) => ({ id: `review-${e.id}`, kind: "review" as const, title: episodeName(e), detail: `${showName(e.show_id)} · ready for review`, ground: groundOf(showById.get(e.show_id)?.theme) })),
    ...failed.map((e) => ({ id: `failed-${e.id}`, kind: "attention" as const, title: episodeName(e), detail: `${showName(e.show_id)} · stopped and needs a look`, ground: null })),
    ...rows.shows.filter((s) => s.compass === null).map((s) => ({ id: `vision-${s.id}`, kind: "setup" as const, title: `Write the vision for ${s.name}`, detail: "What it is, who it is for, and the one goal it builds towards", ground: null })),
    ...rows.shows.filter((s) => s.channels === 0).map((s) => ({ id: `channels-${s.id}`, kind: "setup" as const, title: `Connect where ${s.name} posts`, detail: "Choose the accounts this show publishes to", ground: null })),
  ];

  const inStudio: StudioJob[] = working.map((e) => {
    const show = showById.get(e.show_id);
    const kind = show && isShowKind(show.kind) ? show.kind : "video";
    const p = progressOf(kind, rows.jobs.filter((j) => j.episode_id === e.id));
    return { id: e.id, name: episodeName(e), show: show?.name ?? "A show", stepLabel: p.label, stepIndex: p.index, totalSteps: p.total };
  });

  const week = buildWeek(rows.posts, now, timeZone, showName);
  const postsThisWeek = rows.posts.length;
  const stuck = rows.jobs.filter((j) => j.status === "running" && j.lease_until !== null && new Date(j.lease_until) < now).length;
  const healthy = stuck === 0 && rows.failedJobsThisWeek === 0;

  return {
    dateLabel: dayLabel(now, timeZone),
    greeting: greeting(now, timeZone),
    summary: summarise(ready.length, working.length, postsThisWeek, rows.shows.length),
    forYou,
    inStudio,
    week,
    healthy,
    healthNote: healthy
      ? "All systems well · nothing stuck"
      : listJoin([stuck > 0 ? `${plural(stuck, "step")} stuck` : "", rows.failedJobsThisWeek > 0 ? `${plural(rows.failedJobsThisWeek, "step")} failed this week` : ""].filter(Boolean)),
  };
}

function buildWeek(posts: TodayRows["posts"], now: Date, timeZone: string, showName: (id: string | null) => string): WeekDay[] {
  const days: WeekDay[] = [];
  // Step through calendar days (not 24-hour jumps), so a clock change never skips or repeats a day.
  const [y, m, d] = dayKey(now, timeZone).split("-").map(Number) as [number, number, number];
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i, 12));
    const key = date.toISOString().slice(0, 10);
    const todays = posts.filter((p) => dayKey(new Date(p.scheduled_for), timeZone) === key);
    const byShow = new Map<string, Set<string>>();
    for (const p of todays) {
      const name = showName(p.show_id);
      byShow.set(name, (byShow.get(name) ?? new Set()).add(platformName(p.platform)));
    }
    const items = [...byShow].map(([show, platforms]) => `${show} on ${listJoin([...platforms])}`).join("; ");
    days.push({ key, day: shortDay(date, "UTC"), items: items || "Nothing scheduled" });
  }
  return days;
}

function summarise(ready: number, working: number, posts: number, shows: number): string {
  if (shows === 0) return "Your workspace is ready. Add a show to begin.";
  const parts = [
    ready > 0 ? `${plural(ready, "episode")} ${ready === 1 ? "is" : "are"} ready for you` : "",
    working > 0 ? `${plural(working, "recording")} in the studio` : "",
    posts > 0 ? `${plural(posts, "post")} going out this week` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "A quiet day. Nothing is waiting for you and nothing is scheduled this week.";
  const sentence = listJoin(parts);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function groundOf(theme: unknown): string | null {
  if (theme && typeof theme === "object" && "ground" in theme) {
    const g = (theme as { ground: unknown }).ground;
    if (typeof g === "string" && /^#[0-9a-fA-F]{6}$/.test(g)) return g;
  }
  return null;
}
