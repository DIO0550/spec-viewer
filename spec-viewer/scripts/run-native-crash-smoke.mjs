#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { remote } from "webdriverio";

const binary = resolve("src-tauri/target/debug/spec-viewer");
const gitFixtureEnvironment = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
};
const invoke = async (client, command, request) =>
  client.executeAsync(
    (name, payload, done) => {
      window.__TAURI_INTERNALS__
        .invoke(name, { request: payload })
        .then(done, (error) => done({ __error: String(error) }));
    },
    command,
    request,
  );
const wait = (ms) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function startSession(port, env = process.env) {
  const driver = spawn(
    "tauri-driver",
    ["--port", String(port), "--native-driver", "/usr/bin/WebKitWebDriver"],
    { env, stdio: "inherit" },
  );
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      if (response.ok) break;
    } catch {
      /* startup */
    }
    if (driver.exitCode !== null)
      throw new Error(`tauri-driver exited ${driver.exitCode}`);
    await wait(50);
  }
  const client = await remote({
    hostname: "127.0.0.1",
    port,
    logLevel: "warn",
    capabilities: {
      "wdio:enforceWebDriverClassic": true,
      "tauri:options": { application: binary },
    },
  });
  return { client, driver };
}

async function stopSession(session) {
  try {
    await session.client.deleteSession();
  } catch {
    /* app was intentionally killed */
  }
  session.driver.kill("SIGTERM");
  await wait(100);
}

function prepareRepository(label) {
  const root = mkdtempSync(join(tmpdir(), `spec-viewer-native-${label}-`));
  mkdirSync(join(root, ".plugin-workspace/.specs/199-native"), {
    recursive: true,
  });
  writeFileSync(
    join(root, ".plugin-workspace/.specs/199-native/tasks.md"),
    "# Native\n",
  );
  writeFileSync(join(root, "review.md"), "base line\n");
  for (const args of [
    ["init", "-b", "main"],
    ["config", "user.name", "Native Test"],
    ["config", "user.email", "native@example.invalid"],
    ["add", "review.md"],
    ["commit", "-m", "base"],
  ]) {
    const result = spawnSync("git", args, {
      cwd: root,
      env: gitFixtureEnvironment,
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  }
  writeFileSync(join(root, "review.md"), "changed line\n");
  return root;
}

async function waitReady(path) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      await wait(10);
    }
  }
  throw new Error(`ready signal timed out: ${path}`);
}

async function runPhase(phase, expectedComments, port) {
  const root = prepareRepository(phase);
  const control = mkdtempSync(join(tmpdir(), `spec-viewer-control-${phase}-`));
  chmodSync(control, 0o700);
  const nonce = randomBytes(24).toString("hex");
  let armed;
  let restarted;
  try {
    armed = await startSession(port, {
      ...process.env,
      SPEC_VIEWER_NATIVE_TEST_CONTROL_DIR: control,
      SPEC_VIEWER_NATIVE_TEST_CONTROL_NONCE: nonce,
      SPEC_VIEWER_NATIVE_TEST_CONTROL_PHASE: phase,
    });
    await invoke(armed.client, "load_workspace", { selectedDirectory: root });
    const overview = await invoke(armed.client, "load_repository_diff", {
      worktreeId: root,
      baseOverride: "main",
    });
    if (overview.__error || !overview.diffReviewIdentity)
      throw new Error(
        `repository overview failed: ${JSON.stringify(overview)}`,
      );
    const pendingMutation = armed.client.execute((identity) => {
      window.__nativeMutationSettled = false;
      void window.__TAURI_INTERNALS__
        .invoke("save_diff_comment", {
          request: {
            identity,
            expectedRevision: "0",
            target: {
              side: "current",
              oldPath: "review.md",
              newPath: "review.md",
              line: 1,
            },
            body: `native ${identity.currentSnapshotId}`,
          },
        })
        .then(() => {
          window.__nativeMutationSettled = true;
        });
    }, overview.diffReviewIdentity);
    const ready = await waitReady(join(control, `ready-${nonce}.json`));
    if (
      ready.nonce !== nonce ||
      ready.phase !== phase ||
      !Number.isSafeInteger(ready.pid)
    )
      throw new Error(`invalid ready payload ${JSON.stringify(ready)}`);
    const early = await Promise.race([
      pendingMutation.then(
        () => "settled",
        () => "rejected",
      ),
      wait(25).then(() => "pending"),
    ]);
    if (early !== "pending")
      throw new Error(`mutation ${early} before native kill`);
    process.kill(ready.pid, "SIGKILL");
    await stopSession(armed);
    armed = undefined;
    restarted = await startSession(port + 10);
    await invoke(restarted.client, "load_workspace", {
      selectedDirectory: root,
    });
    const restartedOverview = await invoke(
      restarted.client,
      "load_repository_diff",
      {
        worktreeId: root,
        baseOverride: "main",
      },
    );
    const document = await invoke(restarted.client, "load_diff_comments", {
      identity: restartedOverview.diffReviewIdentity,
    });
    if (document.__error || document.comments?.length !== expectedComments)
      throw new Error(
        `${phase} restart expected ${expectedComments} comments: ${JSON.stringify(document)}`,
      );
    console.log(
      `[R199-NATIVE-${phase === "preReplace" ? "003" : "004"}] ${phase} restart verified ${expectedComments} comment(s)`,
    );
  } finally {
    if (armed) await stopSession(armed);
    if (restarted) await stopSession(restarted);
    rmSync(control, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
}

await runPhase("preReplace", 0, 4450);
await runPhase("postReplace", 1, 4470);
console.log(
  "[R199-NATIVE-002] native process restart restores persisted Diff comments",
);
