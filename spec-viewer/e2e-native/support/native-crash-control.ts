import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type NativeCrashPhase = "preReplace" | "postReplace";
export type ReadySignal = Readonly<{
  nonce: string;
  pid: number;
  phase: NativeCrashPhase;
  documentHash: string;
}>;

export const nativeControlRoot = resolve(
  "src-tauri/target/native-review-control",
);

/** Polls the out-of-band ready file and validates its process-scoped payload. */
export async function waitForReadySignal(
  input: Readonly<{
    directory: string;
    nonce: string;
    phase: NativeCrashPhase;
    timeoutMs?: number;
  }>,
): Promise<ReadySignal> {
  const path = resolve(input.directory, `ready-${input.nonce}.json`);
  const deadline = Date.now() + (input.timeoutMs ?? 10_000);
  while (!existsSync(path) && Date.now() < deadline)
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
  if (!existsSync(path))
    throw new Error(`native ready signal timed out for ${input.nonce}`);
  const signal = JSON.parse(readFileSync(path, "utf8")) as ReadySignal;
  if (signal.nonce !== input.nonce)
    throw new Error("native ready signal nonce mismatch");
  if (signal.phase !== input.phase)
    throw new Error("native ready signal phase mismatch");
  if (!Number.isSafeInteger(signal.pid) || signal.pid <= 0)
    throw new Error("native ready signal PID is invalid");
  if (!/^[0-9a-f]{64}$/.test(signal.documentHash))
    throw new Error("native ready signal document hash is invalid");
  return signal;
}

/** Releases a blocked mutation only as an emergency teardown fallback. */
export function releaseBlockedMutation(directory: string, nonce: string): void {
  writeFileSync(resolve(directory, `release-${nonce}`), "", { flag: "wx" });
}

export function cleanupNativeControl(directory: string): void {
  rmSync(directory, { force: true, recursive: true });
}
