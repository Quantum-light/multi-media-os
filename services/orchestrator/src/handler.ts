import type { z } from "zod";
import type { StepName } from "@mmos/contracts";
import type { ClaimedJob } from "./queue";

/** Throw this when trying again cannot help (bad input, a refused upload). Anything else is retried. */
export class NonRetryableError extends Error {
  override readonly name = "NonRetryableError";
}

export type HandlerContext = {
  job: ClaimedJob;
  /** Aborted when the lease is lost: stop work, the result will be discarded. */
  signal: AbortSignal;
};

export type StepResult<O extends z.ZodTypeAny> = { output: z.input<O>; costPence?: number };

/** One step's implementation, bound to the contract made with `defineStep`. */
export type Handler<I extends z.ZodTypeAny = z.ZodTypeAny, O extends z.ZodTypeAny = z.ZodTypeAny> = {
  step: { name: StepName; input: I; output: O };
  run(input: z.output<I>, ctx: HandlerContext): Promise<StepResult<O>>;
};

/** Keeps the input and output types tied to the step's schemas while letting handlers share one registry. */
export function defineHandler<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(handler: Handler<I, O>): Handler {
  return handler as unknown as Handler;
}
