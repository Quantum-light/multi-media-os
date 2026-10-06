import { z } from "zod";
import { Platform } from "../content";
import { defineStep } from "../pipeline";

/** One post to one channel. The idempotency key is the post's own, so a retry can never double-post. */
export const PublishInput = z.object({
  postId: z.string().uuid(),
  platform: Platform,
  /** The publisher's id for the connected account (channels.zernio_account_id). */
  accountId: z.string().min(1),
  content: z.string().min(1),
  title: z.string().min(1).max(100).optional(),
  media: z.array(z.object({ type: z.enum(["video", "image"]), url: z.string().url() })).max(10),
  scheduledFor: z.string().datetime(),
  idempotencyKey: z.string().min(8),
});
export type PublishInput = z.infer<typeof PublishInput>;

export const PublishOutput = z.object({
  providerPostId: z.string().min(1),
  status: z.enum(["scheduled", "published", "failed"]),
  liveUrl: z.string().url().nullable(),
  /** True when this ran against the fake publisher (tests, dry runs). */
  dryRun: z.boolean(),
});
export type PublishOutput = z.infer<typeof PublishOutput>;

/** Hands one approved post to Zernio. See specs/steps/publish.md. */
export const publish = defineStep({ name: "publish", input: PublishInput, output: PublishOutput });
