import { NextResponse } from "next/server";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseUploadDb } from "./db";
import { UploadError, uploadService, type UploadService } from "./service";
import { r2Store, STORAGE_NOT_CONNECTED } from "./store";

/** Runs one upload API call: signed-in check, body validation, and errors as JSON with the right status. */
export async function handleUpload<S extends z.ZodTypeAny>(request: Request, schema: S, run: (svc: UploadService, body: z.output<S>) => Promise<unknown>) {
  try {
    const store = r2Store();
    if (!store) return NextResponse.json({ code: "storage_not_connected", message: STORAGE_NOT_CONNECTED }, { status: 503 });

    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ code: "signed_out", message: "Sign in again." }, { status: 401 });

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ code: "bad_request", message: "That request was not understood." }, { status: 400 });

    const result = await run(uploadService(supabaseUploadDb(supabase), store), parsed.data);
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ code: error.code, message: error.message, detail: error.detail ?? null }, { status: error.status });
    console.error("[uploads]", error);
    return NextResponse.json({ code: "server_error", message: "Something went wrong on our side. Try again." }, { status: 500 });
  }
}
