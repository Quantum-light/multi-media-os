/** Sleeps, but stops at once (rejecting) when the signal aborts. */
export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("stopped"));
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("stopped"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
