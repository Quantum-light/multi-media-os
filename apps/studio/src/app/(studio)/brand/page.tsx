import Link from "next/link";
import type { BrandKit } from "@mmos/contracts";
import { getBrand } from "@/lib/data";
import { BrandEditor } from "./BrandEditor";

export const metadata = { title: "Brand and style · multi-media os" };

type Props = { searchParams: Promise<{ brand?: string; edit?: string }> };

const MOTION: Record<BrandKit["motion"], string> = {
  thread: "Thread — one line carries through",
  frame: "Frame — things arrive inside an edge",
  pulse: "Pulse — a beat, then stillness",
};

export default async function BrandPage({ searchParams }: Props) {
  const { brand, edit } = await searchParams;
  const data = await getBrand(brand);
  if (!data) {
    return (
      <Intro eyebrow="Brand and style" lead="Add a brand first. Each brand holds its own fonts, colours, movement and never-do list." />
    );
  }

  if (edit === "1") {
    return <BrandEditor slug={data.current.slug} brandName={data.current.name} kit={data.state.kind === "ready" ? data.state.kit : null} />;
  }

  const editHref = `/brand?brand=${data.current.slug}&edit=1`;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <Intro eyebrow={data.current.name} lead="The one place that decides how everything looks and sounds. Change it here and the next draft and the next render obey it." />
        {data.state.kind === "ready" ? <Link href={editHref} className="link-gold">Edit</Link> : null}
      </div>

      {data.brands.length > 1 ? (
        <nav aria-label="Brands" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: -24 }}>
          {data.brands.map((b) => (
            <Link key={b.slug} href={`/brand?brand=${b.slug}`} aria-current={b.slug === data.current.slug ? "page" : undefined} className={b.slug === data.current.slug ? "chip chip--on" : "chip"}>
              {b.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {data.state.kind === "missing" ? (
        <Empty lead={`No brand kit written for ${data.current.name} yet. It needs a story, two fonts, three colours and the things never to do.`} href={editHref} cta="Write the brand kit" />
      ) : data.state.kind === "invalid" ? (
        <Empty lead={`The kit saved for ${data.current.name} is incomplete, so it is not shown here. Writing it again is the quickest way through.`} href={editHref} cta="Write it again" />
      ) : (
        <KitView kit={data.state.kit} slug={data.current.slug} />
      )}
    </>
  );
}

function Intro({ eyebrow, lead }: { eyebrow: string; lead: string }) {
  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="display">Brand and <em>style</em></h1>
      <p className="lead">{lead}</p>
    </header>
  );
}

function Empty({ lead, href, cta }: { lead: string; href: string; cta: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
      <p className="lead">{lead}</p>
      <Link href={href} className="btn-gold">{cta}</Link>
    </div>
  );
}

function KitView({ kit, slug }: { kit: BrandKit; slug: string }) {
  const colours: { label: string; value: string }[] = [
    { label: "Background", value: kit.colours.ground },
    { label: "Accent", value: kit.colours.accent },
    { label: "Text", value: kit.colours.ink },
    ...kit.colours.extra.map((value, i) => ({ label: `Extra ${i + 1}`, value })),
  ];

  return (
    <>
      <section aria-labelledby="story" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="section-head">
          <h2 id="story" className="heading">The story</h2>
          {kit.styleWords.length > 0 ? <span className="quiet">{kit.styleWords.join(" · ")}</span> : null}
        </div>
        <p style={{ fontFamily: "var(--font-title), Georgia, serif", fontSize: 24, lineHeight: 1.35, margin: 0, maxWidth: 720 }}>{kit.story}</p>
      </section>

      <section aria-labelledby="type" className="columns">
        <h2 id="type" className="heading" style={{ flex: "1 1 100%" }}>Type and movement</h2>
        <Fact label="Display font" value={`${kit.fonts.display.family} · ${kit.fonts.display.source === "google" ? "Google" : "uploaded"}`} />
        <Fact label="Body font" value={`${kit.fonts.base.family} · ${kit.fonts.base.source === "google" ? "Google" : "uploaded"}`} />
        <Fact label="How it moves" value={MOTION[kit.motion]} />
      </section>

      <section aria-labelledby="colour">
        <div className="section-head">
          <h2 id="colour" className="heading">Colour</h2>
          <span className="quiet">Never black</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, paddingTop: 24 }}>
          {colours.map((colour) => (
            <div key={colour.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 16, background: colour.value, border: "1px solid var(--hairline)" }} />
              <span className="label">{colour.label}</span>
              <span className="figure" style={{ fontSize: 12, color: "var(--ink-quiet)" }}>{colour.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="never">
        <div className="section-head">
          <h2 id="never" className="heading">Never do</h2>
          <span className="figure" style={{ fontSize: 12, color: "var(--gold-ink)" }}>{String(kit.neverDo.length).padStart(2, "0")}</span>
        </div>
        {kit.neverDo.length === 0 ? <p className="quiet" style={{ paddingTop: 16, margin: 0 }}>Nothing ruled out yet.</p> : null}
        {kit.neverDo.map((rule) => (
          <div key={rule} className="row">
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--gold)" }} />
            <div className="row__body"><span style={{ fontSize: 15 }}>{rule}</span></div>
          </div>
        ))}
      </section>

      {kit.personas.length > 0 ? (
        <section aria-labelledby="who">
          <div className="section-head">
            <h2 id="who" className="heading">Who it is for</h2>
            <span className="quiet">Each one backed by something real</span>
          </div>
          {kit.personas.map((persona) => (
            <div key={persona.name} className="row">
              <div className="row__body">
                <span className="row__title" style={{ fontSize: 16 }}>{persona.name}</span>
                <span className="quiet">{persona.description}</span>
              </div>
              <span className="chip">{persona.evidence.length === 0 ? "No evidence yet" : `${persona.evidence.length} piece${persona.evidence.length === 1 ? "" : "s"} of evidence`}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section aria-labelledby="styles" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="section-head">
          <h2 id="styles" className="heading">Saved styles</h2>
          <Link href={`/brand/styles?brand=${slug}`} className="link-gold">Open Style Studio</Link>
        </div>
        <p className="lead">Named, reusable instructions — how you open an episode, how a short should look. Saved once here, then applied by name.</p>
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="label">{label}</span>
      <span style={{ fontSize: 15 }}>{value}</span>
    </div>
  );
}
