type Kpi = { name: string; current: number; target: number; unit: string; evidenceSource: string };

/** One objective under the main goal, with its KPIs and where each number comes from. */
export function Objective({ index, title, kpis }: { index: number; title: string; kpis: Kpi[] }) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 14, padding: "24px 0", borderBottom: "1px solid var(--hairline)" }}>
      <span style={{ fontSize: 17, fontWeight: 500 }}>
        <span className="figure" style={{ color: "var(--gold-ink)", marginRight: 12 }}>{String(index).padStart(2, "0")}</span>
        {title}
      </span>
      {kpis.map((k) => {
        const pct = Math.min(100, Math.round(k.target === 0 ? 100 : (k.current / k.target) * 100));
        return (
          <div key={k.name} style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr) auto", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>{k.name}</span>
            <span aria-hidden="true" style={{ height: 2, background: "rgba(46,52,66,0.1)" }}>
              <span style={{ display: "block", width: `${pct}%`, height: 2, background: "var(--gold)" }} />
            </span>
            <span className="figure" style={{ fontSize: 12, whiteSpace: "nowrap" }} title={`Evidence: ${k.evidenceSource}`}>
              {k.current}{k.unit} → {k.target}{k.unit}
            </span>
          </div>
        );
      })}
    </article>
  );
}
