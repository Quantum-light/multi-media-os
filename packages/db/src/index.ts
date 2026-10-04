/**
 * The database as TypeScript sees it. `database.types.ts` is generated from the
 * live schema (never edit it by hand); regenerate after every migration.
 */
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

/** Episode states the Studio understands. Anything else reads as "in the studio". */
export const EPISODE_STATES = ["ingesting", "processing", "review", "approved", "published", "failed"] as const;
export type EpisodeState = (typeof EPISODE_STATES)[number];
