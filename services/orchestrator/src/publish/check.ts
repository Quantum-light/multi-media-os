import type { ConnectedAccount } from "./publisher";

export type ChannelRow = { platform: string; handle: string; zernio_account_id: string | null };

const bare = (h: string | null) => (h ?? "").replace(/^@/, "").toLowerCase();

/**
 * Compares the channels the Studio knows with the accounts connected in Zernio, as plain
 * lines for the worker log. Read-only: it never changes a channel.
 */
export function compareChannels(channels: readonly ChannelRow[], accounts: readonly ConnectedAccount[]): string[] {
  return channels.map((c) => {
    const byId = c.zernio_account_id ? accounts.find((a) => a.id === c.zernio_account_id) : undefined;
    if (byId) return `${c.platform} ${c.handle}: connected in Zernio${byId.active ? "" : " but paused there"}`;
    if (c.zernio_account_id) return `${c.platform} ${c.handle}: its Zernio account id is not among the connected accounts (reconnect it in Zernio)`;
    const guess = accounts.find((a) => a.platform === c.platform && bare(a.username) === bare(c.handle)) ?? accounts.find((a) => a.platform === c.platform);
    return guess
      ? `${c.platform} ${c.handle}: no Zernio account id saved; Zernio has ${c.platform} account ${guess.id}${guess.username ? ` (@${bare(guess.username)})` : ""}`
      : `${c.platform} ${c.handle}: not connected in Zernio yet`;
  });
}
