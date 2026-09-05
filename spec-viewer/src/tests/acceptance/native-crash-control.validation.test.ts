import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

import {
  cleanupNativeControl,
  releaseBlockedMutation,
  waitForReadySignal,
} from "../../../e2e-native/support/native-crash-control";

const roots: string[] = [];
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "native-control-"));
  roots.push(root);
  return root;
};

it("[R199-NATIVE-006] mutation remains pending until an out-of-band ready payload", async () => {
  const directory = fixture();
  const nonce = "a".repeat(32);
  writeFileSync(
    join(directory, `ready-${nonce}.json`),
    JSON.stringify({
      nonce,
      pid: 42,
      phase: "preReplace",
      documentHash: "b".repeat(64),
    }),
  );
  await expect(
    waitForReadySignal({ directory, nonce, phase: "preReplace" }),
  ).resolves.toMatchObject({ pid: 42 });
});

it("[R199-NATIVE-007] wrong nonce ready signal is rejected by timeout", async () => {
  const directory = fixture();
  writeFileSync(join(directory, `ready-${"b".repeat(32)}.json`), "{}");
  await expect(
    waitForReadySignal({
      directory,
      nonce: "a".repeat(32),
      phase: "preReplace",
      timeoutMs: 20,
    }),
  ).rejects.toThrow(/timed out/);
});

it("[R199-NATIVE-008] crash control files are cleaned after restart", () => {
  const directory = fixture();
  const nonce = "a".repeat(32);
  mkdirSync(join(directory, "nested"));
  releaseBlockedMutation(directory, nonce);
  cleanupNativeControl(directory);
  expect(() => releaseBlockedMutation(directory, nonce)).toThrow();
});
