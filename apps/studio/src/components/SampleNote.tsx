/** Shown until the screen reads live data, so sample numbers are never mistaken for real ones. */
export function SampleNote() {
  return (
    <p className="quiet" style={{ margin: 0, fontSize: 12 }}>
      Sample data. This screen switches to live data when the database is connected.
    </p>
  );
}
