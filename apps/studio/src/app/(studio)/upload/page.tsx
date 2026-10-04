import { getUploadTargets } from "@/lib/data";
import { UploadPanel } from "./UploadPanel";

export const metadata = { title: "Upload a recording · multi-media os" };

export default async function UploadPage() {
  const data = await getUploadTargets();
  if (!data) return null;

  return (
    <>
      <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
        <span className="eyebrow">New episode</span>
        <h1 className="display">Upload a <em>recording</em></h1>
        <p className="lead">It goes straight to storage in parallel pieces, so large files arrive quickly, and a dropped connection picks up where it stopped. The edit starts the moment it lands.</p>
      </header>
      {data.shows.length === 0 ? (
        <p className="lead">Add a show first.</p>
      ) : !data.storageReady ? (
        <p className="lead">Storage is not connected yet. Once the Cloudflare R2 settings are added, uploads open here.</p>
      ) : (
        <UploadPanel shows={data.shows} />
      )}
    </>
  );
}
