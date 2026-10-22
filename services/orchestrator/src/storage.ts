import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { readR2Settings } from "@mmos/media";

/** What workers need from object storage: read a file once (hashing as it streams), write results. */
export type WorkerStore = {
  download(key: string, dest: string, signal?: AbortSignal): Promise<{ sha256: string; bytes: number }>;
  upload(key: string, src: string, contentType: string, signal?: AbortSignal): Promise<void>;
};

/** Hashes bytes as they pass, so the checksum costs no second read of a multi-gigabyte file. */
function hashing(hash: ReturnType<typeof createHash>, counter: { bytes: number }) {
  return new Transform({
    transform(chunk: Buffer, _enc, done) {
      hash.update(chunk);
      counter.bytes += chunk.length;
      done(null, chunk);
    },
  });
}

/** Cloudflare R2 (any S3-compatible store). Uploads go in parallel parts. */
export function r2WorkerStore(env: NodeJS.ProcessEnv = process.env): WorkerStore {
  const read = readR2Settings(env);
  if (!read.ok) throw new Error(`${read.problem} (in Railway)`);
  const { endpoint, accessKeyId, secretAccessKey, bucket } = read.settings;
  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = bucket;

  return {
    async download(key, dest, signal) {
      await mkdir(dirname(dest), { recursive: true });
      const out = await s3.send(new GetObjectCommand({ Bucket, Key: key }), signal ? { abortSignal: signal } : {});
      if (!out.Body) throw new Error(`Storage returned no body for ${key}`);
      const hash = createHash("sha256");
      const counter = { bytes: 0 };
      await pipeline(out.Body as Readable, hashing(hash, counter), createWriteStream(dest), signal ? { signal } : {});
      return { sha256: hash.digest("hex"), bytes: counter.bytes };
    },
    async upload(key, src, contentType, signal) {
      const upload = new Upload({
        client: s3,
        params: { Bucket, Key: key, Body: createReadStream(src), ContentType: contentType },
        queueSize: 6,
        partSize: 16 * 1024 * 1024,
      });
      signal?.addEventListener("abort", () => void upload.abort(), { once: true });
      await upload.done();
    },
  };
}

/** A folder standing in for storage, for tests and local runs. */
export function folderStore(root: string): WorkerStore & { path(key: string): string } {
  const path = (key: string) => join(root, key);
  return {
    path,
    async download(key, dest) {
      await mkdir(dirname(dest), { recursive: true });
      const hash = createHash("sha256");
      const counter = { bytes: 0 };
      await pipeline(createReadStream(path(key)), hashing(hash, counter), createWriteStream(dest));
      return { sha256: hash.digest("hex"), bytes: counter.bytes };
    },
    async upload(key, src) {
      await mkdir(dirname(path(key)), { recursive: true });
      await copyFile(src, path(key));
      await stat(path(key));
    },
  };
}
