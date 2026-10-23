// Zernio (formerly Late) client — the same calls the old QLS media system used successfully:
// GET /accounts, POST /media/presign → PUT file, POST /posts with mediaItems + scheduledFor.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { need } from "./env.mjs";

const BASE = "https://zernio.com/api/v1";

async function z(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${need("ZERNIO_API_KEY")}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Zernio ${path} ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export async function listAccounts() {
  const raw = await z("/accounts");
  return (raw.accounts ?? raw.data ?? []).map((a) => ({
    id: a._id ?? a.id,
    platform: a.platform,
    name: a.username ?? a.platformUsername ?? a.displayName ?? "",
    profileId: typeof a.profileId === "object" && a.profileId ? a.profileId._id : a.profileId,
  }));
}

export async function uploadVideo(file) {
  const { uploadUrl, publicUrl } = await z("/media/presign", {
    method: "POST", body: JSON.stringify({ filename: basename(file), contentType: "video/mp4" }),
  });
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`Zernio upload failed: ${put.status}`);
  return publicUrl;
}

export async function schedulePost({ content, accounts, videoUrl, scheduledFor, timezone = "Europe/London" }) {
  return z("/posts", {
    method: "POST",
    body: JSON.stringify({
      content,
      platforms: accounts.map((a) => ({ platform: a.platform, accountId: a.id })),
      mediaItems: [{ url: videoUrl, type: "video" }],
      scheduledFor, timezone,
    }),
  });
}
