/** Progress through the pipeline, drawn as a fine gold thread. */
export function StepThread({ current, total }: { current: number; total: number }) {
  return (
    <div role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`Step ${current + 1} of ${total}`} style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: 2,
            background: i < current ? "var(--gold)" : i === current ? "rgba(201,162,74,0.45)" : "rgba(46,52,66,0.12)",
          }}
        />
      ))}
    </div>
  );
}
