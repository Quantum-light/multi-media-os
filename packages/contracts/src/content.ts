import { z } from "zod";

export const ShowKind = z.enum(["podcast", "video", "both"]);
export const Platform = z.enum(["youtube", "youtube_shorts", "instagram", "tiktok", "threads", "x", "linkedin", "podcast", "newsletter", "website"]);

export const Post = z.object({
  id: z.string().uuid(),
  episodeId: z.string().uuid(),
  channelId: z.string().uuid(),
  platform: Platform,
  scheduledFor: z.string().datetime(),
  status: z.enum(["draft", "waiting_review", "scheduled", "published", "failed"]),
  /** Unique per post: a retry can never double-post. */
  idempotencyKey: z.string().min(8),
  liveUrl: z.string().url().nullable(),
});
export type Post = z.infer<typeof Post>;

export const Kpi = z.object({
  name: z.string().min(1),
  current: z.number(),
  target: z.number(),
  unit: z.string().default(""),
  /** Where the number comes from, e.g. "youtube_analytics.returning_viewers". */
  evidenceSource: z.string().min(1),
});

export const Compass = z.object({
  whatItIs: z.string().min(1),
  mission: z.string().min(1),
  pillars: z.array(z.string().min(1)).min(1).max(6),
  howYouSeeIt: z.string().default(""),
  /** True while the numbers are typed in by hand rather than read from evidence. */
  isDraft: z.boolean().optional(),
  vision: z.string().min(1),
  mainGoal: z.object({
    statement: z.string().min(1),
    by: z.string().date(),
    objectives: z.array(z.object({ title: z.string().min(1), kpis: z.array(Kpi).min(1) })).length(3),
  }),
});
export type Compass = z.infer<typeof Compass>;

export const EdgeKind = z.enum(["same_theme", "follows_on", "answers", "contradicts", "part_of_arc", "held_for", "resurfaced_at"]);

export const TimeAnchor = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  date: z.string().date(),
  recurrence: z.enum(["none", "yearly"]),
  scope: z.enum(["global", "workspace", "brand"]),
});
export type TimeAnchor = z.infer<typeof TimeAnchor>;
