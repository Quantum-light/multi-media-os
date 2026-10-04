/** Storage keys. Every object lives under its workspace, so access and clean-up follow tenancy. */

/** Keeps letters, digits, dot, dash and underscore; the rest becomes a dash. Never empty, never a path. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
  return (cleaned || "recording").slice(0, 120);
}

export function sourceKey(workspaceId: string, episodeId: string, fileName: string): string {
  return `ws/${workspaceId}/episodes/${episodeId}/source/${safeFileName(fileName)}`;
}

export function derivedKey(workspaceId: string, episodeId: string, name: string): string {
  return `ws/${workspaceId}/episodes/${episodeId}/derived/${safeFileName(name)}`;
}

/** True when a key belongs to the workspace (guards every signed URL the server hands out). */
export function keyInWorkspace(key: string, workspaceId: string): boolean {
  return key.startsWith(`ws/${workspaceId}/`) && !key.includes("..");
}
