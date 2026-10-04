import { handleUpload } from "@/lib/uploads/http";
import { StartBody } from "@/lib/uploads/schemas";

/** Starts an upload: duplicate check, episode and asset rows, and a multipart upload in R2. */
export function POST(request: Request) {
  return handleUpload(request, StartBody, (svc, body) => svc.start(body));
}
