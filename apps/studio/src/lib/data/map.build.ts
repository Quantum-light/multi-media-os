/**
 * The word search's shaping: what counts as a phrase, which sentence a hit
 * sits in, and where the phrase falls inside it. No data access here, so
 * every one of these is unit-tested.
 */

export type Part = { text: string; hit: boolean };

/** A hit's sentence, already split so the phrase can be shown picked out. */
export type Snippet = { parts: Part[]; trimmedStart: boolean; trimmedEnd: boolean };

/** How long a snippet may run before it is cut back around the phrase. */
const SNIPPET_CHARS = 260;
/** Enough context either side of the phrase when a sentence runs long. */
const SIDE_CHARS = 110;

/** The phrase as typed, with the edges tidied. Too short to be worth searching returns "". */
export function cleanPhrase(raw: string | null | undefined): string {
  const phrase = (raw ?? "").replace(/\s+/g, " ").trim();
  return phrase.length < 2 ? "" : phrase.slice(0, 120);
}

/**
 * A phrase made safe for a Postgres `like` pattern: its own wildcards are
 * taken literally, so searching for "100%" finds "100%" and not everything.
 */
export function likePattern(phrase: string): string {
  return `%${phrase.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Every place the phrase appears, ignoring case. */
export function occurrences(text: string, phrase: string): number[] {
  if (phrase === "") return [];
  const haystack = text.toLowerCase();
  const needle = phrase.toLowerCase();
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + needle.length;
  }
}

const BOUNDARY = /[.!?…]/;

/** Where the sentence holding `at` starts: just after the previous full stop or line break. */
function sentenceStart(text: string, at: number): number {
  for (let i = at - 1; i >= 0; i -= 1) {
    const c = text[i]!;
    if (c === "\n") return i + 1;
    if (BOUNDARY.test(c) && /\s/.test(text[i + 1] ?? " ")) return i + 1;
  }
  return 0;
}

/** Where it ends: through the next full stop, or the next line break. */
function sentenceEnd(text: string, from: number): number {
  for (let i = from; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === "\n") return i;
    if (BOUNDARY.test(c) && /\s/.test(text[i + 1] ?? " ")) return i + 1;
  }
  return text.length;
}

/**
 * The sentence around the first mention of the phrase, split into the words
 * before, the phrase itself, and the words after. A sentence that runs long
 * is cut back to the words either side of the phrase, and says so.
 */
export function snippetAround(text: string, phrase: string): Snippet | null {
  const at = occurrences(text, phrase)[0];
  if (at === undefined) return null;

  let start = sentenceStart(text, at);
  let end = sentenceEnd(text, at + phrase.length);
  let trimmedStart = false;
  let trimmedEnd = false;

  if (end - start > SNIPPET_CHARS) {
    if (at - start > SIDE_CHARS) {
      start = wordEdge(text, at - SIDE_CHARS, "forward");
      trimmedStart = true;
    }
    if (end - (at + phrase.length) > SIDE_CHARS) {
      end = wordEdge(text, at + phrase.length + SIDE_CHARS, "back");
      trimmedEnd = true;
    }
  }

  const before = text.slice(start, at).replace(/^\s+/, "");
  const after = text.slice(at + phrase.length, end).replace(/\s+$/, "");
  return {
    parts: split(`${before}${text.slice(at, at + phrase.length)}${after}`, phrase),
    trimmedStart,
    trimmedEnd,
  };
}

/** Steps to the nearest space, so a cut never lands mid-word. */
function wordEdge(text: string, at: number, direction: "forward" | "back"): number {
  const step = direction === "forward" ? 1 : -1;
  for (let i = at; i > 0 && i < text.length; i += step) {
    if (/\s/.test(text[i]!)) return direction === "forward" ? i + 1 : i;
  }
  return direction === "forward" ? 0 : text.length;
}

/** The whole line split on the phrase, so each mention can be shown picked out. */
export function split(line: string, phrase: string): Part[] {
  const places = occurrences(line, phrase);
  if (places.length === 0) return line === "" ? [] : [{ text: line, hit: false }];

  const parts: Part[] = [];
  let from = 0;
  for (const at of places) {
    if (at > from) parts.push({ text: line.slice(from, at), hit: false });
    parts.push({ text: line.slice(at, at + phrase.length), hit: true });
    from = at + phrase.length;
  }
  if (from < line.length) parts.push({ text: line.slice(from), hit: false });
  return parts;
}

/** Seconds as a timestamp a person reads: 252 -> "4:12", 3730 -> "1:02:10". */
export function clock(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60) % 60;
  const secs = whole % 60;
  const hours = Math.floor(whole / 3600);
  const tail = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${tail}` : `${mins}:${String(secs).padStart(2, "0")}`;
}

/** "3 mentions in this episode", or nothing at all when there is only the one. */
export function mentionsLabel(count: number): string | null {
  return count > 1 ? `${count} mentions here` : null;
}
