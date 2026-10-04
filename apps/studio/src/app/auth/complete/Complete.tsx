"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { readAuthFragment } from "./fragment";

export function Complete({ next }: { next: string }) {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const result = readAuthFragment(window.location.hash);
    // Never leave tokens sitting in the address bar or history.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (result.kind === "error") {
      setProblem(result.message);
      return;
    }
    if (result.kind === "none") {
      setProblem("That sign-in link has already been used or has expired.");
      return;
    }
    createBrowserSupabase()
      .auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken })
      .then(({ error }) => {
        if (error) setProblem("That sign-in link could not be used. Send yourself a new one.");
        else window.location.replace(next);
      });
  }, [next]);

  if (!problem) {
    return <h1 className="display" style={{ fontSize: 40 }}>Signing you <em>in</em>…</h1>;
  }
  return (
    <>
      <h1 className="display" style={{ fontSize: 40 }}>Not <em>quite</em></h1>
      <p className="lead" style={{ margin: 0 }}>{problem}</p>
      <Link href="/login" className="btn-gold" style={{ alignSelf: "flex-start" }}>Send a new link</Link>
    </>
  );
}
