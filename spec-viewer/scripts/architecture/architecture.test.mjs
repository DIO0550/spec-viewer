import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectGraph } from "./graph.mjs";

/** @param {object} files Fixture files. @returns {string} Temporary project root. */
function fixture(t, files) {
  const root = mkdtempSync(path.join(tmpdir(), "architecture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const contents = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        moduleResolution: "bundler",
        module: "esnext",
        baseUrl: ".",
        paths: { "@/*": ["src/*"] },
      },
      include: ["src"],
    }),
    ...files,
  };
  for (const [name, content] of Object.entries(contents)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

test("相対 import と alias を同じ参照先に解決する", (t) => {
  const root = fixture(t, {
    "src/features/a/domain/x.ts":
      'import { y } from "./y"; import type { Y } from "@/features/a/domain/y";',
    "src/features/a/domain/y/index.ts":
      "export const y = 1; export type Y = number;",
  });
  const result = collectGraph(root);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.edges.map((e) => e.to),
    ["src/features/a/domain/y/index.ts", "src/features/a/domain/y/index.ts"],
  );
});

for (const [name, code, kind] of [
  ["型専用", 'import type { Y } from "./y";', "type"],
  ["再 export", 'export { y } from "./y";', "export"],
  ["import 型", 'type Y = import("./y").Y;', "type"],
  ["dynamic import", 'const x = import("./y");', "dynamic"],
  ["require", 'const x = require("./y");', "require"],
  ["import equals", 'import x = require("./y");', "require"],
]) {
  test(`${name} を依存辺として収集する`, (t) => {
    const root = fixture(t, {
      "src/x.ts": code,
      "src/y.ts": "export const y = 1; export type Y = number;",
    });
    const result = collectGraph(root);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(
      result.edges.map((e) => [e.to, e.kind]),
      [["src/y.ts", kind]],
    );
  });
}

for (const [name, files] of [
  ["不定 dynamic import", { "src/x.ts": "import(target);" }],
  ["不定 require", { "src/x.ts": "require(prefix + suffix);" }],
  ["未解決 module", { "src/x.ts": 'import "./missing";' }],
  ["未解決 package", { "src/x.ts": 'import "missing-package";' }],
  ["構文エラー", { "src/x.ts": "const x = ;" }],
  ["空 src", { "src/.keep": "" }],
  ["不正 tsconfig", { "tsconfig.json": "broken", "src/x.ts": "export {};" }],
  ["存在しない asset", { "src/x.ts": 'import "./missing.svg?url";' }],
]) {
  test(`${name} を診断する`, (t) => {
    const result = collectGraph(fixture(t, files));
    assert.ok(result.diagnostics.length > 0);
  });
}

test("tsconfig include 外の全 TypeScript ファイルを走査する", (t) => {
  const root = fixture(t, {
    "tsconfig.json": '{"include":["src/only.ts"]}',
    "src/only.ts": "export {};",
    "src/名前 空白.ts": 'import "./y";',
    "src/extra.mts": 'import "./y";',
    "src/extra.cts": 'import "./y";',
    "src/extra.d.ts": 'import "./y";',
    "src/extra.tsx": 'import "./y";',
    "src/y.ts": "export {};",
  });
  const result = collectGraph(root);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.edges.length, 5);
});

test("asset は存在を確認して種類を保持する", (t) => {
  const root = fixture(t, {
    "src/x.ts":
      'import "./style.css"; import "./y.ts?raw"; import "./logo.svg?url";',
    "src/style.css": "body {}",
    "src/y.ts": "export {};",
    "src/logo.svg": "<svg/>",
  });
  const result = collectGraph(root);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.edges.map((e) => e.kind),
    ["asset", "asset", "asset"],
  );
});

test("JSX の暗黙依存を収集するがコメントと文字列は無視する", (t) => {
  const root = fixture(t, {
    "src/x.tsx":
      'const view = <div/>; // import "missing"\nconst text = "import missing";',
  });
  const result = collectGraph(root);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.edges.map((e) => e.to),
    ["npm:react/jsx-runtime"],
  );
});

test("外部 package と Node 組込を正規化する", (t) => {
  const root = fixture(t, {
    "src/x.ts": 'import "pure-lib"; import "node:fs"; import "fs";',
    "node_modules/pure-lib/package.json":
      '{"name":"pure-lib","types":"index.d.ts"}',
    "node_modules/pure-lib/index.d.ts": "export {};",
  });
  const result = collectGraph(root);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.edges.map((e) => e.to),
    ["npm:pure-lib", "node:fs", "node:fs"],
  );
});

const emptyPolicy = {
  version: 1,
  domainPublicApis: [],
  kernelEntries: [],
  pureExternals: [],
};

/** @param {Array} pairs Directed dependency pairs. @returns {object} Graph supplied at the public rules boundary. */
function dependencyGraph(pairs) {
  return {
    nodes: Array.from(new Set(pairs.flatMap(([from, to]) => [from, to]))),
    edges: pairs.map(([from, to, kind = "static"]) => ({
      from,
      to,
      kind,
      specifier: to,
      line: 1,
    })),
    diagnostics: [],
  };
}

for (const [from, to, rule] of [
  ["src/shared/x.ts", "src/features/a/index.ts", "shared-to-feature"],
  ["src/lib/x.ts", "src/features/a/index.ts", "shared-to-feature"],
  ["src/hooks/x.ts", "src/features/a/index.ts", "shared-to-feature"],
  ["src/components/x.ts", "src/features/a/index.ts", "shared-to-feature"],
  ["src/types/x.ts", "src/features/a/index.ts", "shared-to-feature"],
  ["src/domains/x.ts", "src/features/a/index.ts", "shared-to-feature"],
  [
    "src/features/a/hooks/x.ts",
    "src/features/b/domain/y.ts",
    "feature-public-api",
  ],
  ["src/app/App.tsx", "src/features/a/hooks/x.ts", "feature-public-api"],
  [
    "src/features/a/application/x.ts",
    "src/features/a/infra/y.ts",
    "layer-direction",
  ],
  [
    "src/features/a/application/x.ts",
    "src/features/a/components/y.tsx",
    "layer-direction",
  ],
  ["src/features/a/infra/x.ts", "src/features/a/hooks/y.ts", "layer-direction"],
  [
    "src/features/a/components/x.tsx",
    "src/features/a/infra/y.ts",
    "layer-direction",
  ],
  ["src/features/a/hooks/x.ts", "src/app/context/y.ts", "layer-direction"],
  ["src/features/a/application/x.ts", "npm:react", "layer-direction"],
  [
    "src/features/a/application/x.ts",
    "npm:@tauri-apps/api/core",
    "layer-direction",
  ],
  [
    "src/features/a/x.test.ts",
    "src/features/b/domain/y.ts",
    "feature-public-api",
  ],
  [
    "src/features/a/X.stories.tsx",
    "src/features/b/domain/y.ts",
    "feature-public-api",
  ],
  ...["x.test.ts", "x.spec.ts", "X.stories.tsx", "__tests__/fixture.ts"].map(
    (file) => [
      "src/features/a/x.ts",
      `src/features/a/${file}`,
      "production-to-test",
    ],
  ),
  ["src/features/a/x.ts", "src/tests/fixture.ts", "production-to-test"],
]) {
  test(`${rule}: ${from} → ${to} を拒否する`, async () => {
    const { findViolations } = await import("./rules.mjs");
    const result = findViolations(dependencyGraph([[from, to]]), emptyPolicy);
    assert.ok(
      result.some((v) => v.rule === rule && v.from === from && v.to === to),
    );
  });
}

for (const [from, to] of [
  ["src/features/a/hooks/x.ts", "src/features/b/index.ts"],
  ["src/app/App.tsx", "src/features/b/index.ts"],
  ["src/features/a/application/x.ts", "src/features/a/domain/y.ts"],
  ["src/features/a/infra/x.ts", "src/features/a/application/y.ts"],
  ["src/features/a/hooks/x.ts", "src/features/a/application/y.ts"],
  ["src/features/a/domain/x.test.ts", "npm:vitest"],
]) {
  test(`${from} → ${to} の正方向を許可する`, async () => {
    const { findViolations } = await import("./rules.mjs");
    assert.deepEqual(
      findViolations(dependencyGraph([[from, to]]), emptyPolicy),
      [],
    );
  });
}

const kernelPolicy = {
  ...emptyPolicy,
  kernelEntries: [
    { entry: "src/domains/id/index.ts", reason: "Shared identity", issue: 105 },
  ],
};
const domainApiPolicy = {
  ...kernelPolicy,
  domainPublicApis: [
    {
      entry: "src/features/b/domain/index.ts",
      reason: "Pure entry",
      issue: 106,
    },
  ],
};

for (const target of [
  "npm:react",
  "npm:@tauri-apps/api/core",
  "node:fs",
  "src/lib/api/x.ts",
  "src/shared/api/x.ts",
  "src/hooks/x.ts",
  "src/components/X.tsx",
  "src/features/a/application/x.ts",
  "src/features/a/infra/x.ts",
  "src/features/a/presentation/x.ts",
  "src/domains/unregistered/index.ts",
  "src/domains/id/private.ts",
  "src/app/x.ts",
  "src/features/b/domain/private.ts",
  "src/features/b/index.ts",
]) {
  test(`domain から ${target} への依存を拒否する`, async () => {
    const { findViolations } = await import("./rules.mjs");
    const from = "src/features/a/domain/x.ts";
    assert.ok(
      findViolations(dependencyGraph([[from, target]]), domainApiPolicy).some(
        (v) => v.rule === "domain-dependency" && v.to === target,
      ),
    );
  });
}

test("認定入口とその内部だけを純粋な依存として許可する", async () => {
  const { findViolations } = await import("./rules.mjs");
  const graph = dependencyGraph([
    ["src/features/a/domain/x.ts", "src/features/a/domain/y.ts"],
    ["src/features/a/domain/x.ts", "src/features/b/domain/index.ts"],
    ["src/features/b/domain/index.ts", "src/features/b/domain/y.ts"],
    ["src/features/b/domain/y.ts", "src/domains/id/index.ts"],
    ["src/domains/id/index.ts", "src/domains/id/validate.ts"],
  ]);
  assert.deepEqual(findViolations(graph, domainApiPolicy), []);
});

test("barrel 経由でも禁止先へ到達する全起点を報告する", async () => {
  const { findViolations } = await import("./rules.mjs");
  const from = "src/features/a/domain/x.ts";
  const graph = dependencyGraph([
    [from, "src/features/b/domain/index.ts"],
    ["src/features/b/domain/index.ts", "src/features/b/domain/y.ts", "export"],
    ["src/features/b/domain/y.ts", "npm:react"],
  ]);
  const result = findViolations(graph, domainApiPolicy);
  assert.deepEqual(
    result.find((v) => v.from === from && v.to === "npm:react")?.path,
    [
      from,
      "src/features/b/domain/index.ts",
      "src/features/b/domain/y.ts",
      "npm:react",
    ],
  );
});

test("循環を停止し最短経路で複数の禁止先を重複なく報告する", async () => {
  const { findViolations } = await import("./rules.mjs");
  const from = "src/features/a/domain/x.ts";
  const y = "src/features/a/domain/y.ts";
  const graph = dependencyGraph([
    [from, y],
    [y, from],
    [y, "npm:react"],
    [from, "npm:react"],
    [y, "npm:@tauri-apps/api/core"],
  ]);
  const result = findViolations(graph, emptyPolicy).filter(
    (v) => v.from === from,
  );
  assert.equal(result.length, 2);
  assert.deepEqual(result.find((v) => v.to === "npm:react")?.path, [
    from,
    "npm:react",
  ]);
  assert.deepEqual(
    findViolations(
      { ...graph, edges: [...graph.edges].reverse() },
      emptyPolicy,
    ),
    findViolations(graph, emptyPolicy),
  );
});

test("Kernel の内部にある外側依存も拒否する", async () => {
  const { findViolations } = await import("./rules.mjs");
  const graph = dependencyGraph([
    ["src/domains/id/index.ts", "src/domains/id/validate.ts"],
    ["src/domains/id/validate.ts", "npm:react"],
  ]);
  const result = findViolations(graph, kernelPolicy);
  assert.ok(
    result.some(
      (v) =>
        v.rule === "kernel-dependency" &&
        v.from === "src/domains/id/index.ts" &&
        v.to === "npm:react",
    ),
  );
});

test("同 domain 内でも asset とテストへの依存を拒否する", async () => {
  const { findViolations } = await import("./rules.mjs");
  const from = "src/features/a/domain/x.ts";
  const result = findViolations(
    dependencyGraph([
      [from, "src/features/a/domain/y.ts", "asset"],
      [from, "src/features/a/domain/y.test.ts"],
    ]),
    emptyPolicy,
  );
  assert.equal(result.filter((v) => v.rule === "domain-dependency").length, 2);
});

test("pure external は subpath を暗黙許可しない", async () => {
  const { findViolations } = await import("./rules.mjs");
  const policy = {
    ...emptyPolicy,
    pureExternals: [
      { package: "pure-lib", reason: "Pure operations", issue: 105 },
    ],
  };
  const graph = dependencyGraph([
    ["src/features/a/domain/x.ts", "npm:pure-lib"],
    ["src/features/a/domain/x.ts", "npm:pure-lib/private"],
  ]);
  assert.deepEqual(
    findViolations(graph, policy).map((v) => v.to),
    ["npm:pure-lib/private"],
  );
});

const existingException = {
  rule: "shared-to-feature",
  from: "src/lib/x.ts",
  to: "src/features/a/index.ts",
  reason: "Move adapter",
  issue: 107,
};

for (const [name, value] of [
  ["未知 version", { ...emptyPolicy, version: 2 }],
  ["未知キー", { ...emptyPolicy, extra: true }],
  ["配列型不正", { ...emptyPolicy, kernelEntries: {} }],
  [
    "entry 型不正",
    { ...emptyPolicy, kernelEntries: [{ entry: 12, reason: "a", issue: 105 }] },
  ],
  [
    "認定理由欠落",
    {
      ...emptyPolicy,
      kernelEntries: [{ entry: "src/domains/id/index.ts", issue: 105 }],
    },
  ],
  [
    "認定 Issue 欠落",
    {
      ...emptyPolicy,
      kernelEntries: [{ entry: "src/domains/id/index.ts", reason: "a" }],
    },
  ],
  [
    "空理由",
    {
      ...emptyPolicy,
      kernelEntries: [
        { entry: "src/domains/id/index.ts", reason: " ", issue: 105 },
      ],
    },
  ],
  [
    "Issue 型不正",
    {
      ...emptyPolicy,
      kernelEntries: [
        { entry: "src/domains/id/index.ts", reason: "a", issue: "105" },
      ],
    },
  ],
  [
    "Issue ゼロ",
    {
      ...emptyPolicy,
      kernelEntries: [
        { entry: "src/domains/id/index.ts", reason: "a", issue: 0 },
      ],
    },
  ],
  [
    "未存在入口",
    {
      ...emptyPolicy,
      kernelEntries: [
        { entry: "src/domains/missing/index.ts", reason: "a", issue: 105 },
      ],
    },
  ],
  [
    "入口重複",
    {
      ...emptyPolicy,
      kernelEntries: [
        ...kernelPolicy.kernelEntries,
        ...kernelPolicy.kernelEntries,
      ],
    },
  ],
  [
    "入口包含",
    {
      ...kernelPolicy,
      kernelEntries: [
        ...kernelPolicy.kernelEntries,
        { entry: "src/domains/id/nested/index.ts", reason: "a", issue: 105 },
      ],
    },
  ],
  [
    "公開 API 場所不正",
    {
      ...emptyPolicy,
      domainPublicApis: [
        { entry: "src/features/a/hooks/index.ts", reason: "a", issue: 105 },
      ],
    },
  ],
  ...[
    "react",
    "react/jsx-runtime",
    "react-dom/client",
    "@tauri-apps/api/core",
    "node:fs",
    "fs",
  ].map((pkg) => [
    `認定禁止 ${pkg}`,
    {
      ...emptyPolicy,
      pureExternals: [{ package: pkg, reason: "a", issue: 105 }],
    },
  ]),
]) {
  test(`policy の ${name} を拒否する`, async () => {
    const { validatePolicy } = await import("./rules.mjs");
    assert.ok(
      validatePolicy(value, [
        "src/domains/id/index.ts",
        "src/domains/id/nested/index.ts",
      ]).length > 0,
    );
  });
}

for (const [name, entries] of [
  ["配列以外", {}],
  ["重複", [existingException, existingException]],
  ["空理由", [{ ...existingException, reason: "" }]],
  ["未知キー", [{ ...existingException, extra: true }]],
  ["未知規則", [{ ...existingException, rule: "parse-error" }]],
  ["glob", [{ ...existingException, from: "src/lib/*.ts" }]],
  ["不正 from", [{ ...existingException, from: "src/lib/../lib/x.ts" }]],
  ["不正 Issue", [{ ...existingException, issue: "107" }]],
  [
    "to 欠落",
    [
      {
        rule: "shared-to-feature",
        from: "src/lib/x.ts",
        reason: "a",
        issue: 107,
      },
    ],
  ],
]) {
  test(`例外の ${name} を拒否する`, async () => {
    const { validateExceptions } = await import("./rules.mjs");
    assert.ok(
      validateExceptions({ version: 1, entries }, [
        existingException.from,
        existingException.to,
      ]).length > 0,
    );
  });
}

test("有効な認定設定と完全一致例外だけを受け入れる", async () => {
  const { validatePolicy, validateExceptions, matchExceptions } = await import(
    "./rules.mjs"
  );
  assert.deepEqual(
    validatePolicy(domainApiPolicy, [
      "src/domains/id/index.ts",
      "src/features/b/domain/index.ts",
    ]),
    [],
  );
  assert.deepEqual(
    validateExceptions({ version: 1, entries: [existingException] }, [
      existingException.from,
      existingException.to,
    ]),
    [],
  );
  assert.deepEqual(matchExceptions([existingException], [existingException]), {
    unexpected: [],
    stale: [],
  });
  assert.deepEqual(matchExceptions([], []), { unexpected: [], stale: [] });
});

for (const [field, value] of [
  ["from", "src/lib/y.ts"],
  ["to", "src/features/b/index.ts"],
  ["rule", "feature-public-api"],
]) {
  test(`例外の ${field} が違えば新規違反として拒否する`, async () => {
    const { matchExceptions } = await import("./rules.mjs");
    const violation = { ...existingException, [field]: value };
    assert.deepEqual(matchExceptions([violation], [existingException]), {
      unexpected: [violation],
      stale: [existingException],
    });
  });
}

test("違反が消えた例外を stale として報告する", async () => {
  const { matchExceptions } = await import("./rules.mjs");
  assert.deepEqual(matchExceptions([], [existingException]), {
    unexpected: [],
    stale: [existingException],
  });
});

/** @param {object} t Test context. @param {object} files Overrides. @returns {string} Configured fixture project. */
function checkFixture(t, files = {}) {
  return fixture(t, {
    "src/lib/x.ts": 'import "../features/a";',
    "src/features/a/index.ts": "export {};",
    "scripts/architecture/policy.json": JSON.stringify(emptyPolicy),
    "scripts/architecture/exceptions.json": '{"version":1,"entries":[]}',
    ...files,
  });
}

const checkerPath = fileURLToPath(new URL("./check.mjs", import.meta.url));

test("CLI は新規違反を診断して失敗しファイルを変更しない", (t) => {
  const root = checkFixture(t);
  const config = path.join(root, "scripts/architecture/exceptions.json");
  const before = readFileSync(config, "utf8");
  const result = spawnSync(process.execPath, [checkerPath, "--project", root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /shared-to-feature.*src\/lib\/x.ts.*src\/features\/a\/index.ts/,
  );
  assert.equal(readFileSync(config, "utf8"), before);
});

test("CLI は登録済み違反だけなら成功して件数を表示する", (t) => {
  const root = checkFixture(t, {
    "scripts/architecture/exceptions.json": JSON.stringify({
      version: 1,
      entries: [existingException],
    }),
  });
  const result = spawnSync(process.execPath, [checkerPath, "--project", root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 approved existing violations/);
});

test("CLI は使われなくなった例外を失敗させる", (t) => {
  const root = checkFixture(t, {
    "src/lib/x.ts": "export {};",
    "scripts/architecture/exceptions.json": JSON.stringify({
      version: 1,
      entries: [existingException],
    }),
  });
  const result = spawnSync(process.execPath, [checkerPath, "--project", root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /stale-exception/);
});

for (const [name, files, rule] of [
  ["不正 JSON", { "scripts/architecture/policy.json": "{" }, "invalid-config"],
  [
    "不正設定",
    { "scripts/architecture/policy.json": '{"version":1}' },
    "invalid-config",
  ],
  ["構文エラー", { "src/lib/x.ts": "const x = ;" }, "parse-error"],
  [
    "未解決 import",
    { "src/lib/x.ts": 'import "./missing";' },
    "unresolved-import",
  ],
]) {
  test(`CLI は ${name} を成功扱いしない`, (t) => {
    const root = checkFixture(t, files);
    const result = spawnSync(
      process.execPath,
      [checkerPath, "--project", root],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(rule));
  });
}

for (const args of [["--unknown"], ["--project"]]) {
  test(`CLI は不正引数 ${args.join(" ")} を拒否する`, () => {
    const result = spawnSync(process.execPath, [checkerPath, ...args], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  });
}

test("module import は CLI を実行せず runCheck が結果を返す", async (t) => {
  const { runCheck } = await import("./check.mjs");
  const root = checkFixture(t, { "src/lib/x.ts": "export {};" });
  assert.deepEqual(runCheck(root), {
    exitCode: 0,
    diagnostics: [],
    allowedCount: 0,
  });
  const url = new URL("./check.mjs", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("設定ファイルがない場合も診断して失敗する", async (t) => {
  const { runCheck } = await import("./check.mjs");
  const root = checkFixture(t);
  rmSync(path.join(root, "scripts/architecture/policy.json"));
  assert.equal(runCheck(root).exitCode, 1);
});

test("内部 symlink は重複排除し外部 symlink は拒否する", (t) => {
  const root = fixture(t, {
    "src/x.ts": 'import "./y";',
    "src/y.ts": "export {};",
  });
  symlinkSync(path.join(root, "src/y.ts"), path.join(root, "src/alias.ts"));
  assert.equal(
    collectGraph(root).nodes.filter((n) => n === "src/y.ts").length,
    1,
  );
  const outside = fixture(t, { "outside.ts": "export {};" });
  symlinkSync(
    path.join(outside, "outside.ts"),
    path.join(root, "src/outside.ts"),
  );
  assert.ok(
    collectGraph(root).diagnostics.some((d) => d.rule === "outside-project"),
  );
});

test("tooling は直接辺の検査起点にせず src の境界だけを検査する", async () => {
  const { findViolations } = await import("./rules.mjs");
  assert.deepEqual(
    findViolations(
      dependencyGraph([["scripts/evidence.d.mts", "src/tests/fixture.ts"]]),
      emptyPolicy,
    ),
    [],
  );
});

test("外側を経由しても同 feature domain 自体は新たな禁止先にならない", async () => {
  const { findViolations } = await import("./rules.mjs");
  const from = "src/features/a/domain/x.ts";
  const result = findViolations(
    dependencyGraph([
      [from, "src/lib/api/x.ts"],
      ["src/lib/api/x.ts", "src/features/a/domain/y.ts"],
    ]),
    emptyPolicy,
  );
  assert.deepEqual(
    result.filter((v) => v.from === from).map((v) => v.to),
    ["src/lib/api/x.ts"],
  );
});

test("未認定の別 feature domain に入っても以後の内部依存を自動許可しない", async () => {
  const { findViolations } = await import("./rules.mjs");
  const from = "src/features/a/domain/x.ts";
  const result = findViolations(
    dependencyGraph([
      [from, "src/features/b/domain/x.ts"],
      ["src/features/b/domain/x.ts", "src/features/b/domain/y.ts"],
    ]),
    emptyPolicy,
  );
  assert.deepEqual(
    result
      .filter((v) => v.from === from && v.rule === "domain-dependency")
      .map((v) => v.to),
    ["src/features/b/domain/x.ts", "src/features/b/domain/y.ts"],
  );
});

test("asset の型宣言があっても asset の種類と実ファイル存在を確認する", (t) => {
  const root = fixture(t, {
    "tsconfig.json":
      '{"compilerOptions":{"moduleResolution":"bundler","module":"esnext","allowArbitraryExtensions":true},"include":["src"]}',
    "src/x.ts": 'import style from "./style.css";',
    "src/style.d.css.ts": "declare const style: string; export default style;",
    "src/style.css": "body {}",
  });
  const graph = collectGraph(root);
  assert.deepEqual(graph.diagnostics, []);
  assert.deepEqual(
    graph.edges.map((e) => [e.to, e.kind]),
    [["src/style.css", "asset"]],
  );
  rmSync(path.join(root, "src/style.css"));
  assert.ok(
    collectGraph(root).diagnostics.some((d) => d.rule === "unresolved-import"),
  );
});

test("ドットを含む拡張子省略 module 名を asset と誤認しない", (t) => {
  const root = fixture(t, {
    "src/x.ts": 'import "./value.fixture";',
    "src/value.fixture.ts": "export {};",
  });
  const graph = collectGraph(root);
  assert.deepEqual(graph.diagnostics, []);
  assert.deepEqual(
    graph.edges.map((e) => e.to),
    ["src/value.fixture.ts"],
  );
});

test("拡張子省略の宣言 module を通常の型依存として解決する", (t) => {
  const root = fixture(t, {
    "src/x.ts": 'import type { Value } from "./values";',
    "src/values.d.ts": "export type Value = string;",
  });
  const graph = collectGraph(root);
  assert.deepEqual(graph.diagnostics, []);
  assert.deepEqual(
    graph.edges.map((e) => [e.to, e.kind]),
    [["src/values.d.ts", "type"]],
  );
});

test("presentation からも認定 Kernel の内部へ直接参照できない", async () => {
  const { findViolations } = await import("./rules.mjs");
  const graph = dependencyGraph([
    ["src/features/a/hooks/x.ts", "src/domains/id/private.ts"],
  ]);
  assert.ok(
    findViolations(graph, kernelPolicy).some(
      (v) => v.rule === "kernel-public-api",
    ),
  );
});
