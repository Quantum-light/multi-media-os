/** A quiet line under a screen that says how far to trust what is on it. */
export function Note({ children }: { children: React.ReactNode }) {
  return <p className="quiet" style={{ margin: 0, fontSize: 12 }}>{children}</p>;
}
