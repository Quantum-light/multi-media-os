import { stepsFor, type StepName } from "@mmos/contracts";

/** How each pipeline step reads to a person. */
export const STEP_LABELS: Record<StepName, string> = {
  ingest: "Taking it in",
  transcribe: "Transcribing",
  cut: "Cutting",
  understand: "Finding the moments",
  write: "Writing",
  clip: "Clipping",
  storyboard: "Storyboarding",
  compose: "Composing graphics",
  render: "Rendering",
  review: "Ready for review",
  publish: "Publishing",
};

export type ShowKind = "podcast" | "video" | "both";

export function isShowKind(kind: string): kind is ShowKind {
  return kind === "podcast" || kind === "video" || kind === "both";
}

type JobLike = { step: string; status: string; created_at: string };

/** Where an episode is in its pipeline, from its jobs (newest wins). */
export function progressOf(kind: ShowKind, jobs: JobLike[]): { index: number; total: number; label: string } {
  const steps = stepsFor(kind);
  const latest = [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) return { index: 0, total: steps.length, label: "Waiting to start" };
  const at = steps.indexOf(latest.step as StepName);
  if (at === -1) return { index: 0, total: steps.length, label: "Waiting to start" };
  if (latest.status === "failed") return { index: at, total: steps.length, label: `${STEP_LABELS[steps[at]!]} · stopped` };
  const index = latest.status === "succeeded" ? Math.min(at + 1, steps.length - 1) : at;
  return { index, total: steps.length, label: STEP_LABELS[steps[index]!] };
}
