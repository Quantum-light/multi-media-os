import { listJoin, platformName } from "@/lib/format";

export const ROLES = ["owner", "editor", "approver", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  approver: "Approver",
  viewer: "Viewer",
};

export const ROLE_NOTES: Record<Role, string> = {
  owner: "Everything, including people and settings",
  editor: "Uploads, edits and writes, but does not approve",
  approver: "Approves at Review and schedules",
  viewer: "Looks, and changes nothing",
};

export type MemberLine = { key: string; who: string; you: boolean; role: string };
export type InviteLine = { id: string; email: string; role: string; accepted: boolean; on: string };
export type ChannelLine = { id: string; label: string; handle: string; connected: boolean; shows: string[] };
export type StepSpend = { step: string; pence: number; jobs: number };

export type SettingsData = {
  workspace: { name: string; brands: number; shows: number };
  members: MemberLine[];
  invites: InviteLine[];
  channels: ChannelLine[];
  spend: {
    monthLabel: string;
    lastMonthLabel: string;
    thisMonthPence: number;
    lastMonthPence: number;
    jobs: number;
    byStep: StepSpend[];
  };
};

export type SettingsRows = {
  workspace: { name: string; brands: number; shows: number };
  members: { user_id: string; role: string }[];
  invites: { id: string; email: string; role: string; accepted_at: string | null; created_at: string }[];
  channels: { id: string; platform: string; handle: string; status: string }[];
  links: { show_id: string; channel_id: string }[];
  shows: { id: string; name: string }[];
  /** Jobs from the start of last month onwards, which is all the spend this screen reports. */
  jobs: { step: string; cost_pence: number; created_at: string }[];
};

export type SignedIn = { userId: string; email: string };

/** Who is in the workspace, what it is connected to, and what it has cost. Pure and tested. */
export function buildSettings(rows: SettingsRows, now: Date, timeZone: string, me: SignedIn): SettingsData {
  const showName = new Map(rows.shows.map((s) => [s.id, s.name]));

  const members = rows.members.map((m) => {
    const you = m.user_id === me.userId;
    return {
      key: m.user_id,
      who: you ? me.email : `Member ${m.user_id.slice(0, 8)}`,
      you,
      role: roleLabel(m.role),
    };
  });

  const invites = rows.invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: roleLabel(i.role),
    accepted: i.accepted_at !== null,
    on: dayWords(i.accepted_at ?? i.created_at, timeZone),
  }));

  const channels = rows.channels.map((c) => ({
    id: c.id,
    label: `${platformName(c.platform)} ${c.handle}`,
    handle: c.handle,
    connected: c.status === "connected",
    shows: rows.links.filter((l) => l.channel_id === c.id).flatMap((l) => showName.get(l.show_id) ?? []),
  }));

  return { workspace: rows.workspace, members, invites, channels, spend: buildSpend(rows.jobs, now, timeZone) };
}

/** This month's spend and last month's, with this month broken down by step. */
export function buildSpend(
  jobs: SettingsRows["jobs"],
  now: Date,
  timeZone: string,
): SettingsData["spend"] {
  const thisKey = monthKey(now, timeZone);
  const lastKey = monthKey(new Date(startOfMonth(now, timeZone).getTime() - 86_400_000), timeZone);

  const mine = jobs.filter((j) => monthKey(new Date(j.created_at), timeZone) === thisKey);
  const byStep = new Map<string, StepSpend>();
  for (const job of mine) {
    const seen = byStep.get(job.step) ?? { step: job.step, pence: 0, jobs: 0 };
    byStep.set(job.step, { step: job.step, pence: seen.pence + job.cost_pence, jobs: seen.jobs + 1 });
  }

  return {
    monthLabel: monthWords(thisKey),
    lastMonthLabel: monthWords(lastKey),
    thisMonthPence: mine.reduce((sum, j) => sum + j.cost_pence, 0),
    lastMonthPence: jobs
      .filter((j) => monthKey(new Date(j.created_at), timeZone) === lastKey)
      .reduce((sum, j) => sum + j.cost_pence, 0),
    jobs: mine.length,
    byStep: [...byStep.values()].sort((a, b) => b.pence - a.pence || a.step.localeCompare(b.step)),
  };
}

/** The instant the current month began, as the workspace's time zone sees it. */
export function startOfMonth(now: Date, timeZone: string): Date {
  const [year, month] = monthKey(now, timeZone).split("-").map(Number);
  const guess = Date.UTC(year!, month! - 1, 1, 0, 0, 0);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** The instant last month began, which is as far back as this screen reads jobs. */
export function startOfLastMonth(now: Date, timeZone: string): Date {
  return startOfMonth(new Date(startOfMonth(now, timeZone).getTime() - 86_400_000), timeZone);
}

/** "2026-10" for the month the date falls in, in that time zone. */
export function monthKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone }).format(date).slice(0, 7);
}

/** "October 2026", from a month key. */
export function monthWords(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year!, month! - 1, 1)),
  );
}

/** "4 October 2026". */
export function dayWords(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(iso));
}

/** Pence as money a person reads: "£12.34", and "nothing" for zero. */
export function money(pence: number): string {
  if (pence === 0) return "nothing";
  return `£${(pence / 100).toFixed(2)}`;
}

/** What is wrong with an invite, in sentences. Empty means it is fine to send. */
export function checkInvite(email: string, role: string, existing: string[]): string[] {
  const problems: string[] = [];
  const clean = email.trim().toLowerCase();
  if (clean === "") problems.push("The email address is still empty.");
  else if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(clean)) problems.push(`"${email.trim()}" does not look like an email address.`);
  else if (existing.map((e) => e.toLowerCase()).includes(clean)) problems.push(`${clean} has already been invited.`);
  if (!isRole(role)) problems.push(`"${role}" is not one of ${listJoin(ROLES.map((r) => ROLE_LABELS[r]))}.`);
  return problems;
}

export function isRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

function roleLabel(role: string): string {
  return isRole(role) ? ROLE_LABELS[role] : role;
}

/** How far the time zone is from UTC at that instant, in milliseconds. */
function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(at("year"), at("month") - 1, at("day"), at("hour") % 24, at("minute"), at("second"));
  return asUtc - date.getTime();
}
