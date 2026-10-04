/** Small pure helpers for screens. No data access here, so every one is unit-tested. */

/** "Quantum Light Science" -> "QLS". At most three letters. */
export function initials(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).map((w) => w[0]?.toUpperCase() ?? "");
  return letters.join("").slice(0, 3) || "·";
}

/** Hour of the day (0-23) in a time zone. */
export function hourIn(date: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(date);
  return Number.parseInt(h, 10) % 24;
}

export function greeting(date: Date, timeZone: string): string {
  const h = hourIn(date, timeZone);
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** "Sunday 4 October" in the given time zone. */
export function dayLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(date);
}

/** "Tue 6" in the given time zone. */
export function shortDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", timeZone }).format(date).replace(",", "");
}

/** A calendar key like "2026-10-06" for the date as seen in the time zone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(date);
}

/** Only same-site paths survive, so a link can never send someone elsewhere. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

/** Average progress across KPIs, each capped at 100%. */
export function overallProgress(kpis: { current: number; target: number }[]): number {
  if (kpis.length === 0) return 0;
  const sum = kpis.reduce((acc, k) => acc + Math.max(0, Math.min(1, k.target === 0 ? 1 : k.current / k.target)), 0);
  return Math.round((sum / kpis.length) * 100);
}

/** "1 episode", "3 episodes". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Joins a list for a sentence: "a, b and c". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube", youtube_shorts: "YouTube Shorts", instagram: "Instagram", tiktok: "TikTok", threads: "Threads",
  x: "X", linkedin: "LinkedIn", podcast: "Podcast", newsletter: "Newsletter", website: "Website",
};
export function platformName(platform: string): string {
  return PLATFORM_NAMES[platform] ?? platform;
}
