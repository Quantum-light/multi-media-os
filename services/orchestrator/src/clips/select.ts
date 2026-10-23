import type { ScoredClip, ClipPlan, ClipSignal } from "@mmos/contracts";

/**
 * Turning a pile of scored moments into the slate a person actually reviews.
 *
 * This half of the finder is deliberately dumb and deterministic: the model
 * proposes candidates, and these rules decide which survive. Keeping the rules
 * here rather than in the prompt means they can be tested, explained in Clip
 * Studio, and changed without re-running an expensive pass over the episode.
 */
export type SelectOptions = {
  /** How many the show wants: 21 for Human Time, 9–12 for the podcast. */
  target: number;
  /** Below this, a clip is not offered at all. Padding the slate is worse than coming up short. */
  minScore?: number;
  minSeconds?: number;
  maxSeconds?: number;
  /** How much two clips may share before they count as the same moment, as a fraction of the shorter one. */
  maxOverlap?: number;
  /** Give every signal that found anything at least one slot before filling the rest by score. */
  ensureEachSignal?: boolean;
};

const DEFAULTS = { minScore: 50, minSeconds: 8, maxSeconds: 90, maxOverlap: 0.25, ensureEachSignal: true };

export function selectClips(candidates: readonly ScoredClip[], options: SelectOptions): ClipPlan {
  const { target } = options;
  const minScore = options.minScore ?? DEFAULTS.minScore;
  const minSeconds = options.minSeconds ?? DEFAULTS.minSeconds;
  const maxSeconds = options.maxSeconds ?? DEFAULTS.maxSeconds;
  const maxOverlap = options.maxOverlap ?? DEFAULTS.maxOverlap;
  const ensureEachSignal = options.ensureEachSignal ?? DEFAULTS.ensureEachSignal;

  const worthOffering = candidates.filter((c) => {
    const seconds = c.endS - c.startS;
    return c.score >= minScore && seconds >= minSeconds && seconds <= maxSeconds;
  });

  // Best first; ties broken by position so the same episode always gives the same slate.
  const ranked = [...worthOffering].sort((a, b) => b.score - a.score || a.startS - b.startS);

  // One moment, one clip. A lower-scoring clip of the same moment is not a second short.
  const distinct: ScoredClip[] = [];
  for (const candidate of ranked) {
    if (!distinct.some((kept) => overlapFraction(kept, candidate) > maxOverlap)) distinct.push(candidate);
  }

  const ordered = ensureEachSignal ? signalFirst(distinct, target) : distinct;

  const chosen = ordered.slice(0, target);
  const reserve = ordered.slice(target);
  return { version: 1, target, chosen, reserve, shortfall: Math.max(0, target - chosen.length) };
}

/**
 * Twenty-one clips that are all the same kind of moment make a monotonous week,
 * even when each one scores well. So the best of each signal is promoted into
 * the slate first, and everything after that is pure score.
 */
function signalFirst(ranked: readonly ScoredClip[], target: number): ScoredClip[] {
  const seen = new Set<ClipSignal>();
  const first: ScoredClip[] = [];
  const rest: ScoredClip[] = [];

  for (const candidate of ranked) {
    if (!seen.has(candidate.signal) && first.length < target) {
      seen.add(candidate.signal);
      first.push(candidate);
    } else {
      rest.push(candidate);
    }
  }
  return [...first, ...rest];
}

/** How much two clips share, as a fraction of the shorter one. 0 when they do not touch. */
export function overlapFraction(a: ScoredClip, b: ScoredClip): number {
  const shared = Math.min(a.endS, b.endS) - Math.max(a.startS, b.startS);
  if (shared <= 0) return 0;
  const shorter = Math.min(a.endS - a.startS, b.endS - b.startS);
  return shorter <= 0 ? 0 : shared / shorter;
}

/** What to tell a person when the episode did not give the show what it wanted. */
export function describeShortfall(plan: ClipPlan): string | null {
  if (plan.shortfall === 0) return null;
  const found = plan.chosen.length;
  if (found === 0) return `Nothing in this episode cleared the bar, so there are no shorts to review.`;
  return `This episode gave ${found} of the ${plan.target} wanted. The rest were weaker than the bar, so they were left out rather than padded in.`;
}
