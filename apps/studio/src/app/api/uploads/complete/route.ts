import { handleUpload } from "@/lib/uploads/http";
import { CompleteBody } from "@/lib/uploads/schemas";

/** Joins the parts, checks the size, and hands the episode to the pipeline. */
export function POST(request: Request) {
  return handleUpload(request, CompleteBody, (svc, body) => svc.complete(body.assetId, body.uploadId, body.parts));
}
