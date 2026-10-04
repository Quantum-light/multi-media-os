import { Rail } from "@/components/Rail";
import { getShell } from "@/lib/data";
import { plural } from "@/lib/format";

// Every Studio screen reads the signed-in person's data, so none can be prerendered.
export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const shell = await getShell();
  const ws = shell.workspace;

  return (
    <div className="stage">
      <div className="stage__rail">
        <Rail
          workspaceName={ws?.name ?? "No workspace yet"}
          mark={ws?.mark ?? "·"}
          meta={ws ? `${plural(ws.brands, "brand")} · ${plural(ws.shows, "show")}` : "Waiting for an invite"}
          userEmail={shell.userEmail}
        />
      </div>
      <main className="sheet glass">
        {ws ? children : (
          <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 640 }}>
            <span className="eyebrow">Welcome</span>
            <h1 className="display">You are <em>almost</em> in</h1>
            <p className="lead">This account is not part of a workspace yet. Ask the person who runs your studio to invite this email address, then sign in again.</p>
          </header>
        )}
      </main>
    </div>
  );
}
