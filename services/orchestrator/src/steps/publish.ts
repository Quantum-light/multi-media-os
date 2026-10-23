import { publish } from "@mmos/contracts";
import { defineHandler, NonRetryableError } from "../handler";
import type { Publisher } from "../publish/publisher";

/**
 * Episodes Grace has said may go out for real, from PUBLISH_LIVE_EPISODES (comma-separated
 * episode ids). Empty means nothing is ever posted to a real channel.
 */
export function liveEpisodes(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
  return new Set((env.PUBLISH_LIVE_EPISODES ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * Publish (specs/steps/publish.md): hands one approved post to the publisher with its own
 * idempotency key. A live publisher only runs for episodes on the go-ahead list.
 */
export function publishHandler(deps: { publisher: Publisher; allowed: ReadonlySet<string> }) {
  return defineHandler({
    step: publish,
    async run(input, { job, signal }) {
      if (deps.publisher.live && !deps.allowed.has(job.episodeId)) {
        throw new NonRetryableError("Live publishing is not switched on for this episode. Grace gives the go-ahead per episode (PUBLISH_LIVE_EPISODES).");
      }
      const status = await deps.publisher.schedule(input, signal);
      if (status.status === "failed") throw new NonRetryableError(`The publisher refused the post: ${status.error ?? "no reason given"}`);
      return { output: { providerPostId: status.providerPostId, status: status.status, liveUrl: status.liveUrl, dryRun: !deps.publisher.live } };
    },
  });
}
