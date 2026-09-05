#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Resolves a unique Cargo test suffix to its fully-qualified test name.
 *
 * @param {string} listedTests - Output from `cargo test -- --list`.
 * @param {string} suffix - Stable acceptance leaf suffix.
 * @returns {{kind: "resolved", testName: string} | {kind: "invalid", reason: "notFound" | "ambiguous"}}
 */
export const resolveCargoLeafName = (listedTests, suffix) => {
  const matches = listedTests
    .split("\n")
    .filter((line) => line.endsWith(": test"))
    .map((line) => line.slice(0, -": test".length))
    .filter((name) => name.endsWith(suffix));
  if (matches.length === 0) {
    return { kind: "invalid", reason: "notFound" };
  }
  if (matches.length > 1) {
    return { kind: "invalid", reason: "ambiguous" };
  }
  return { kind: "resolved", testName: matches[0] };
};

const run = (command, args) =>
  spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

const main = () => {
  const suffix = process.argv[2];
  if (!suffix) {
    throw new Error("Usage: run-cargo-leaf.mjs <unique-test-suffix>");
  }
  const manifestArgs = ["test", "--manifest-path", "src-tauri/Cargo.toml"];
  const listed = run("cargo", [...manifestArgs, "--", "--list"]);
  if (listed.status !== 0) {
    process.exit(listed.status ?? 1);
  }
  const resolved = resolveCargoLeafName(listed.stdout, suffix);
  if (resolved.kind === "invalid") {
    throw new Error(`Cargo leaf ${suffix} is ${resolved.reason}`);
  }
  const executed = spawnSync(
    "cargo",
    [...manifestArgs, resolved.testName, "--", "--exact"],
    { stdio: "inherit" },
  );
  process.exit(executed.status ?? 1);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
