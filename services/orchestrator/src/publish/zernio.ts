import type { PublishInput } from "@mmos/contracts";
import { NonRetryableError } from "../handler";
import type { ConnectedAccount, PostStatus, Publisher } from "./publisher";

type Fetch = typeof fetch;
type Json = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** The per-platform options Zernio expects inside each `platforms[]` entry. */
export function platformData(post: PublishInput): Json | undefined {
  if (post.platform === "youtube") return { title: post.title ?? post.content.slice(0, 100), visibility: "public", madeForKids: false, containsSyntheticMedia: false };
  if (post.platform === "youtube_shorts") return { title: post.title ?? post.content.slice(0, 100), visibility: "public", madeForKids: false };
  return undefined;
}

export function toStatus(raw: unknown): PostStatus {
  const post = (raw && typeof raw === "object" && "post" in raw ? (raw as { post: unknown }).post : raw) as Json | null;
  if (!post) throw new Error("Zernio returned no post");
  const id = str(post._id) ?? str(post.id);
  if (!id) throw new Error("Zernio returned a post without an id");
  const targets = Array.isArray(post.platforms) ? (post.platforms as Json[]) : [];
  const t = targets[0] ?? {};
  const s = str(t.status) ?? str(post.status) ?? "scheduled";
  const status = s === "published" ? "published" : s === "failed" || s === "error" ? "failed" : "scheduled";
  return { providerPostId: id, status, liveUrl: str(t.platformPostUrl) ?? str(t.publishedUrl) ?? null, error: str(t.errorMessage) ?? str(post.errorMessage) };
}

/**
 * Zernio over HTTPS. Every create carries the post's own Idempotency-Key, so a retry
 * (same key, same body) replays the first answer instead of posting twice.
 */
export function zernio(opts: { apiKey: string; baseUrl?: string; fetch?: Fetch }): Publisher {
  const base = (opts.baseUrl ?? "https://zernio.com/api/v1").replace(/\/$/, "");
  const doFetch = opts.fetch ?? fetch;

  async function call(path: string, init: { method: string; body?: Json; idempotencyKey?: string }, signal?: AbortSignal): Promise<unknown> {
    const headers: Record<string, string> = { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" };
    if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;
    const res = await doFetch(`${base}${path}`, { method: init.method, headers, ...(init.body ? { body: JSON.stringify(init.body) } : {}), ...(signal ? { signal } : {}) });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new NonRetryableError(`Zernio refused the key (${res.status}). Check ZERNIO_API_KEY in Railway.`);
    if (res.status === 422 || res.status === 400) throw new NonRetryableError(`Zernio rejected the post: ${text.slice(0, 300)}`);
    if (!res.ok) throw new Error(`Zernio ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }

  return {
    live: true,
    async listAccounts(signal) {
      const raw = (await call("/accounts", { method: "GET" }, signal)) as Json;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.accounts) ? raw.accounts : [];
      return (list as Json[]).map((a): ConnectedAccount => ({
        id: str(a._id) ?? str(a.id) ?? "",
        platform: str(a.platform) ?? "unknown",
        username: str(a.username) ?? str(a.displayName),
        active: a.isActive !== false,
      }));
    },
    async schedule(post, signal) {
      const data = platformData(post);
      const body: Json = {
        content: post.content,
        scheduledFor: post.scheduledFor,
        timezone: "UTC",
        mediaItems: post.media.map((m) => ({ type: m.type, url: m.url })),
        platforms: [{ platform: post.platform === "youtube_shorts" ? "youtube" : post.platform, accountId: post.accountId, ...(data ? { platformSpecificData: data } : {}) }],
      };
      return toStatus(await call("/posts", { method: "POST", body, idempotencyKey: post.idempotencyKey }, signal));
    },
    async status(providerPostId, signal) {
      return toStatus(await call(`/posts/${encodeURIComponent(providerPostId)}`, { method: "GET" }, signal));
    },
  };
}
