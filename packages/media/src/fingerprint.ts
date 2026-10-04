const EDGE_BYTES = 8 * 1024 * 1024;

/**
 * A quick fingerprint of a large file: SHA-256 of its size plus its first and last 8 MiB.
 * Reads at most 16 MiB, so it is instant even for a 10 GB recording, and catches the
 * same file being uploaded twice before any bytes move. ("qf1:" marks the scheme.)
 */
export async function quickFingerprint(file: Blob): Promise<string> {
  const head = file.slice(0, Math.min(EDGE_BYTES, file.size));
  const tail = file.size > EDGE_BYTES ? file.slice(Math.max(EDGE_BYTES, file.size - EDGE_BYTES)) : new Blob([]);
  const sizeBytes = new TextEncoder().encode(`${file.size}:`);
  const data = new Uint8Array(await new Blob([sizeBytes, head, tail]).arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return `qf1:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
