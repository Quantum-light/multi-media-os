import { handleUpload } from "@/lib/uploads/http";
import { SignBody } from "@/lib/uploads/schemas";

/** Signed URLs so the browser sends each part straight to R2 (the Studio never carries the bytes). */
export function POST(request: Request) {
  return handleUpload(request, SignBody, (svc, body) => svc.sign(body.assetId, body.uploadId, body.partNumbers));
}
