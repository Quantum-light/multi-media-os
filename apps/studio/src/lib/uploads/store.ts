import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { CompletedPart } from "@mmos/media";

/** What the upload service needs from object storage. R2 today; any S3-compatible store works. */
export type ObjectStore = {
  createUpload(key: string, contentType: string): Promise<string>;
  signPart(key: string, uploadId: string, partNumber: number): Promise<string>;
  listParts(key: string, uploadId: string): Promise<CompletedPart[]>;
  complete(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  abort(key: string, uploadId: string): Promise<void>;
  size(key: string): Promise<number | null>;
};

const SIGNED_URL_SECONDS = 60 * 60;

/** Server-only settings. Never NEXT_PUBLIC: these keys can write to storage. */
function r2Env() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const jurisdiction = process.env.R2_JURISDICTION === "eu" ? ".eu" : "";
  return { endpoint: `https://${accountId}${jurisdiction}.r2.cloudflarestorage.com`, accessKeyId, secretAccessKey, bucket };
}

export const STORAGE_NOT_CONNECTED = "Storage is not connected yet. Add the R2 settings to the Studio's environment.";

/** Cloudflare R2 through its S3 API, or null when the settings are missing. */
export function r2Store(): ObjectStore | null {
  const env = r2Env();
  if (!env) return null;
  const s3 = new S3Client({
    region: "auto",
    endpoint: env.endpoint,
    credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    // R2 does not accept the SDK's default extra checksum headers on presigned part uploads.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = env.bucket;

  return {
    async createUpload(key, contentType) {
      const out = await s3.send(new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: contentType }));
      if (!out.UploadId) throw new Error("Storage did not start the upload");
      return out.UploadId;
    },
    signPart(key, uploadId, partNumber) {
      return getSignedUrl(s3, new UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: SIGNED_URL_SECONDS });
    },
    async listParts(key, uploadId) {
      const parts: CompletedPart[] = [];
      let marker: string | undefined;
      do {
        const out = await s3.send(new ListPartsCommand({ Bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }));
        for (const p of out.Parts ?? []) if (p.PartNumber && p.ETag) parts.push({ partNumber: p.PartNumber, etag: p.ETag });
        marker = out.IsTruncated ? out.NextPartNumberMarker : undefined;
      } while (marker);
      return parts;
    },
    async complete(key, uploadId, parts) {
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
      }));
    },
    async abort(key, uploadId) {
      await s3.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
    },
    async size(key) {
      try {
        const out = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
        return out.ContentLength ?? null;
      } catch {
        return null;
      }
    },
  };
}
