/**
 * Shaping for Clip Studio. Pure: rows in, a slate out.
 *
 * The clips table is append-only, so an episode can carry several runs of the
 * finder. Only the newest run is ever shown; the older rows stay as a record.
 * Ranks run 1 upwards across the whole slate, chosen and reserve together, so
 * rank is the one true order and nothing here renumbers anything.
 */

export type ClipState = "chosen" | "reserve" | "approved" | "rejected";

/** One row of public.clips, as the database hands it over. */
export type ClipRow = {
  id: string;
  job_id: string;
  rank: number;
  state: string;
  signal: string;
  score: number;
  start_s: number;
  end_s: number;
  hook: string;
  quote: string;
  reason: string;
  decided_at: string | null;
  created_at: string;
};

/** One clip, ready to read on the screen. */
export type ClipCard = {
  id: string;
  rank: number;
  state: ClipState;
  /** The signal the finder claimed, in Grace's words. */
  signal: string;
  score: string;
  hook: string;
  quote: string;
  reason: string;
  /** Its place in the recording, as 4:12-5:08. */
  span: string;
  /** How long it runs, as a sentence fragment: "56 seconds". */
  length: string;
  decided: boolean;
};

export type ClipSlate = {
  /** The run being shown. Null when the finder has not run yet. */
  jobId: string | null;
  /** How many this show wanted, when the run said so. */
  target: number | null;
  chosen: ClipCard[];
  reserve: ClipCard[];
  setAside: ClipCard[];
  /** Chosen and approved together: what the episode actually has. */
  standing: number;
  approved: number;
  /** How far short of the target the episode fell. 0 when it met it. */
  shortfall: number;
  /** "7 chosen of the 21 this episode wanted." */
  countLine: string;
  /** Said out loud when the episode came up short, otherwise null. */
  shortfallLine: string | null;
  empty: boolean;
};

const SIGNALS: Record<string, string> = {
  standalone_idea: "Stands alone",
  opening_line: "Opening line",
  surprising: "Surprising",
  personal: "Personal",
};

const STATES = new Set<ClipState>(["chosen", "reserve", "approved", "rejected"]);

/** The signal in words, falling back to the stored name if the finder adds one. */
export function signalLabel(signal: string): string {
  return SIGNALS[signal] ?? signal.replace(/_/g, " ");
}

/** Seconds as m:ss. 252 is 4:12. */
export function mmss(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Where a clip sits in the recording, as 4:12-5:08. */
export function span(startS: number, endS: number): string {
  return `${mmss(startS)}-${mmss(endS)}`;
}

/** How long it runs, in whole seconds. */
export function lengthLabel(startS: number, endS: number): string {
  const seconds = Math.max(0, Math.round(endS - startS));
  return seconds === 1 ? "1 second" : `${seconds} seconds`;
}

/** The rows of the newest run only, in rank order. */
export function newestRun(rows: ClipRow[]): ClipRow[] {
  if (rows.length === 0) return [];
  let newest = rows[0]!;
  for (const row of rows) if (row.created_at > newest.created_at) newest = row;
  return rows.filter((r) => r.job_id === newest.job_id).sort((a, b) => a.rank - b.rank);
}

/** Everything the board shows, from the newest run's rows and the target it was given. */
export function buildSlate(rows: ClipRow[], target: number | null): ClipSlate {
  const run = newestRun(rows);
  const cards = run.map(toCard);
  const chosen = cards.filter((c) => c.state === "chosen" || c.state === "approved");
  const reserve = cards.filter((c) => c.state === "reserve");
  const setAside = cards.filter((c) => c.state === "rejected");
  const approved = cards.filter((c) => c.state === "approved").length;
  const standing = chosen.length;
  const shortfall = target === null ? 0 : Math.max(0, target - standing);

  return {
    jobId: run[0]?.job_id ?? null,
    target,
    chosen,
    reserve,
    setAside,
    standing,
    approved,
    shortfall,
    countLine: countLine(standing, target, approved),
    shortfallLine: shortfallLine(shortfall, reserve.length),
    empty: run.length === 0,
  };
}

function toCard(row: ClipRow): ClipCard {
  return {
    id: row.id,
    rank: row.rank,
    state: asState(row.state),
    signal: signalLabel(row.signal),
    score: scoreLabel(row.score),
    hook: row.hook,
    quote: row.quote,
    reason: row.reason,
    span: span(row.start_s, row.end_s),
    length: lengthLabel(row.start_s, row.end_s),
    decided: row.decided_at !== null,
  };
}

/** An unexpected state reads as reserve rather than disappearing from the board. */
export function asState(state: string): ClipState {
  return STATES.has(state as ClipState) ? (state as ClipState) : "reserve";
}

/** Whole numbers stay whole; anything else keeps one decimal. */
export function scoreLabel(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** How many are chosen against how many the episode wanted, in one plain line. */
export function countLine(standing: number, target: number | null, approved = 0): string {
  const approvedPart = approved > 0 ? ` ${approved} of them ${approved === 1 ? "has" : "have"} been approved.` : "";
  if (standing === 0 && target === null) return "Nothing is chosen yet.";
  if (target === null) return `${standing} chosen. This run did not say how many the episode wanted.${approvedPart}`;
  return `${standing} chosen of the ${target} this episode wanted.${approvedPart}`;
}

/** Said when the episode came up short, rather than padding the slate out. */
export function shortfallLine(shortfall: number, reserve: number): string | null {
  if (shortfall <= 0) return null;
  const short = `This episode came up ${shortfall} short.`;
  if (reserve === 0) return `${short} The finder had nothing else that clears the bar, so the rest would have to come from another recording.`;
  const held = reserve === 1 ? "1 clip is held in reserve" : `${reserve} clips are held in reserve`;
  return `${short} ${held}, so you can pull one up if it earns its place.`;
}
