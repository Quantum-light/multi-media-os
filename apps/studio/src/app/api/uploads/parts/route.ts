import { handleUpload } from "@/lib/uploads/http";
import { RefBody } from "@/lib/uploads/schemas";

/** Parts already in storage, so an interrupted upload resumes instead of starting again. */
export function POST(request: Request) {
  return handleUpload(request, RefBody, async (svc, body) => ({ parts: await svc.parts(body.assetId, body.uploadId) }));
}
