import { spawn } from "node:child_process";

/** Runs a command, keeping the tail of stderr for error messages. Aborting the signal kills it. */
export function run(command: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...(signal ? { signal } : {}) });
    let stdout = "";
    let stderrTail = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderrTail = (stderrTail + d.toString()).slice(-2000); });
    child.on("error", (e) => reject(e));
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with ${code}: ${stderrTail.trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}
