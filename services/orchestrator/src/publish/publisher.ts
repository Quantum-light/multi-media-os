import type { PublishInput } from "@mmos/contracts";

export type ConnectedAccount = { id: string; platform: string; username: string | null; active: boolean };

export type PostStatus = { providerPostId: string; status: "scheduled" | "published" | "failed"; liveUrl: string | null; error: string | null };

/**
 * Where approved posts go. Zernio in production; `FakePublisher` everywhere else.
 * `schedule` must be idempotent on the post's idempotency key: the same key never makes a second post.
 */
export interface Publisher {
  readonly live: boolean;
  listAccounts(signal?: AbortSignal): Promise<ConnectedAccount[]>;
  schedule(post: PublishInput, signal?: AbortSignal): Promise<PostStatus>;
  status(providerPostId: string, signal?: AbortSignal): Promise<PostStatus>;
}

/** Records every post in memory; never talks to a network. Same key, same post. */
export class FakePublisher implements Publisher {
  readonly live = false;
  readonly posts = new Map<string, { input: PublishInput; status: PostStatus }>();
  constructor(private readonly accounts: ConnectedAccount[] = []) {}

  async listAccounts() {
    return this.accounts;
  }

  async schedule(post: PublishInput): Promise<PostStatus> {
    const existing = this.posts.get(post.idempotencyKey);
    if (existing) return existing.status;
    const status: PostStatus = { providerPostId: `fake_${this.posts.size + 1}`, status: "scheduled", liveUrl: null, error: null };
    this.posts.set(post.idempotencyKey, { input: post, status });
    return status;
  }

  async status(providerPostId: string): Promise<PostStatus> {
    for (const p of this.posts.values()) if (p.status.providerPostId === providerPostId) return p.status;
    throw new Error(`No post ${providerPostId}`);
  }

  /** Test helper: pretend the platform published it. */
  markPublished(providerPostId: string, liveUrl: string) {
    for (const p of this.posts.values()) if (p.status.providerPostId === providerPostId) p.status = { ...p.status, status: "published", liveUrl };
  }
}
