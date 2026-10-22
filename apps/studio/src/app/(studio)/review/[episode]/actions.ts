"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { approveEpisode, chat, restoreVersion, savePiece } from "@/lib/review/service";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const Id = z.string().uuid();
const message = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

export async function savePieceAction(episodeId: string, pieceId: string, body: string): Promise<ActionResult> {
  try {
    const version = await savePiece(await createClient(), Id.parse(pieceId), z.string().min(1).max(10000).parse(body), "person");
    revalidatePath(`/review/${Id.parse(episodeId)}`);
    return { ok: true, message: `Saved as version ${version}` };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}

export async function restoreVersionAction(episodeId: string, pieceId: string, version: number): Promise<ActionResult> {
  try {
    const v = await restoreVersion(await createClient(), Id.parse(pieceId), z.number().int().positive().parse(version));
    revalidatePath(`/review/${Id.parse(episodeId)}`);
    return { ok: true, message: `Restored as version ${v}` };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}

const History = z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(4000) })).min(1).max(24);

export async function chatAction(episodeId: string, history: { role: "user" | "assistant"; text: string }[]): Promise<{ ok: boolean; reply: string; edited: string[] }> {
  try {
    const out = await chat(await createClient(), Id.parse(episodeId), History.parse(history));
    if (out.edits.length) revalidatePath(`/review/${episodeId}`);
    return { ok: true, reply: out.reply, edited: out.edits.map((e) => `${e.label} (version ${e.version})`) };
  } catch (e) {
    return { ok: false, reply: message(e), edited: [] };
  }
}

export async function approveAction(episodeId: string): Promise<ActionResult> {
  let scheduled: number;
  try {
    scheduled = await approveEpisode(await createClient(), Id.parse(episodeId));
  } catch (e) {
    return { ok: false, message: message(e) };
  }
  revalidatePath("/review");
  revalidatePath("/");
  redirect(`/review?approved=${scheduled}`);
}
