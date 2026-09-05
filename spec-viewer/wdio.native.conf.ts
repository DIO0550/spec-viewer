import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DRIVER_HOST = "127.0.0.1";
const DRIVER_PORT = 4444;
const FIXTURE_ROOT = resolve("src-tauri/target/native-tooling-spike-workspace");
const APPLICATION_PATH = resolve("src-tauri/target/debug/spec-viewer");
const BUILD_READY_PATH = resolve("src-tauri/target/native-tooling-spike.ready");
const GIT_FIXTURE_ENV = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
};

let tauriDriver: ChildProcess | undefined;
let shuttingDown = false;

/** Creates the smallest valid plugin workspace used by the native IPC spike. */
function prepareFixture(): void {
  rmSync(FIXTURE_ROOT, { force: true, recursive: true });
  mkdirSync(
    resolve(FIXTURE_ROOT, ".plugin-workspace/.specs/001-native-spike"),
    {
      recursive: true,
    },
  );
  writeFileSync(
    resolve(FIXTURE_ROOT, ".plugin-workspace/.specs/001-native-spike/tasks.md"),
    "# Native tooling spike\n",
  );
  writeFileSync(resolve(FIXTURE_ROOT, "review.md"), "base line\n");
  for (const args of [
    ["init", "-b", "main"],
    ["config", "user.name", "Native Test"],
    ["config", "user.email", "native@example.invalid"],
    ["add", "review.md"],
    ["commit", "-m", "fixture base"],
  ]) {
    const git = spawnSync("git", args, {
      cwd: FIXTURE_ROOT,
      env: GIT_FIXTURE_ENV,
      stdio: "inherit",
    });
    if (git.status !== 0) {
      throw new Error(
        `native fixture git ${args[0]} failed with status ${git.status}`,
      );
    }
  }
  writeFileSync(resolve(FIXTURE_ROOT, "review.md"), "changed line\n");
}

/** Stops the direct tauri-driver child if the runner started it. */
function stopTauriDriver(): void {
  shuttingDown = true;
  tauriDriver?.kill("SIGTERM");
  tauriDriver = undefined;
}

export const config: WebdriverIO.Config = {
  host: DRIVER_HOST,
  port: DRIVER_PORT,
  specs: ["./e2e-native/native-tooling-spike.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "wdio:enforceWebDriverClassic": true,
      "tauri:options": {
        application: APPLICATION_PATH,
      },
    },
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    timeout: 60_000,
  },
  onPrepare: (): void => {
    prepareFixture();
    rmSync(BUILD_READY_PATH, { force: true });
    const build = spawnSync(
      "pnpm",
      [
        "tauri",
        "build",
        "--debug",
        "--no-bundle",
        "--features",
        "native-test-control",
      ],
      { stdio: "inherit" },
    );
    if (build.status !== 0) {
      throw new Error(`native spike build failed with status ${build.status}`);
    }
    writeFileSync(BUILD_READY_PATH, "ready\n");
  },
  beforeSession: (): void => {
    if (!existsSync(BUILD_READY_PATH)) {
      throw new Error("native spike build did not complete successfully");
    }
    tauriDriver = spawn(
      "tauri-driver",
      [
        "--port",
        String(DRIVER_PORT),
        "--native-driver",
        "/usr/bin/WebKitWebDriver",
      ],
      { stdio: "inherit" },
    );
    tauriDriver.once("error", (error) => {
      throw error;
    });
    tauriDriver.once("exit", (code) => {
      if (!shuttingDown) {
        throw new Error(`tauri-driver exited unexpectedly with code ${code}`);
      }
    });
  },
  afterSession: (): void => {
    stopTauriDriver();
  },
  onComplete: (): void => {
    stopTauriDriver();
    rmSync(FIXTURE_ROOT, { force: true, recursive: true });
    rmSync(BUILD_READY_PATH, { force: true });
  },
};

process.once("SIGINT", stopTauriDriver);
process.once("SIGTERM", stopTauriDriver);

export const nativeToolingSpikeFixtureRoot = FIXTURE_ROOT;
