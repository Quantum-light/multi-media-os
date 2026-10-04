import { handleUpload } from "@/lib/uploads/http";
import { RefBody } from "@/lib/uploads/schemas";

/** Cancels an upload and removes its unfinished episode. */
export function POST(request: Request) {
  return handleUpload(request, RefBody, (svc, body) => svc.abort(body.assetId, body.uploadId));
}
