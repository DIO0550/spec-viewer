import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  auditFrontendArchitecture,
  collectModuleSpecifiers,
  violationKey,
} from "./check.mjs";

const createFixture = (files) => {
  const root = mkdtempSync(path.join(tmpdir(), "frontend-architecture-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }

  return root;
};

const removeFixture = (root) => {
  rmSync(root, { recursive: true, force: true });
};

test("collectModuleSpecifiers finds imports, re-exports, dynamic imports, and import types", () => {
  const dependencies = collectModuleSpecifiers(`
    import value from "package-a";
    import type { TypeA } from "package-b";
    export { value as renamed } from "package-c";
    export type { TypeB } from "package-d";
    const lazy = import("package-e");
    type LazyType = import("package-f").LazyType;
    const json = import("package-g", { with: { type: "json" } });
  `);

  assert.deepEqual(
    dependencies.map(({ specifier }) => specifier),
    [
      "package-a",
      "package-b",
      "package-c",
      "package-d",
      "package-e",
      "package-f",
      "package-g",
    ],
  );
});

test("domain modules reject React, Tauri, shared API, hooks, components, and infra dependencies", () => {
  const root = createFixture({
    "features/alpha/domain/model.ts": `
      import React from "react";
      import { invoke } from "@tauri-apps/api/core";
      import { command } from "@/shared/api/tauri";
      import { useThing } from "@/features/alpha/hooks/useThing";
      import { Thing } from "@/features/alpha/components/Thing";
      import { repository } from "../infra/repository";
      import type { CommandError } from "@/features/alpha/infra/tauri/command";
      export const model = [React, invoke, command, useThing, Thing, repository];
    `,
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "domain-forbidden-dependency",
    );

    assert.equal(violations.length, 7);
    assert.deepEqual(
      violations.map(({ specifier }) => specifier),
      [
        "../infra/repository",
        "@/features/alpha/components/Thing",
        "@/features/alpha/hooks/useThing",
        "@/features/alpha/infra/tauri/command",
        "@/shared/api/tauri",
        "@tauri-apps/api/core",
        "react",
      ],
    );
  } finally {
    removeFixture(root);
  }
});

test("domain modules reject react-dom and JSX syntax without an explicit React import", () => {
  const root = createFixture({
    "features/alpha/domain/view.tsx": `
      import { createPortal } from "react-dom";
      export const view = <div>{createPortal}</div>;
    `,
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "domain-forbidden-dependency",
    );

    assert.deepEqual(
      violations.map(({ specifier }) => specifier),
      ["<jsx>", "react-dom"],
    );
  } finally {
    removeFixture(root);
  }
});

test("domain TypeScript angle-bracket assertions are not treated as JSX", () => {
  const root = createFixture({
    "features/alpha/domain/model.ts":
      "export const identifier = <Identifier>rawIdentifier;",
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    assert.deepEqual(audit.violations, []);
  } finally {
    removeFixture(root);
  }
});

test("domain modules only depend on their domain layer or the approved Shared Kernel", () => {
  const root = createFixture({
    "features/alpha/domain/model.ts": `
      import { useCase } from "@/features/alpha/application/useCase";
      import { SharedView } from "@/shared/ui/SharedView";
      import { beta } from "@/features/beta";
      import { WorkspacePath } from "@/shared/domain/workspacePath";
      export const model = [useCase, SharedView, beta, WorkspacePath];
    `,
    "features/beta/index.ts": "export const beta = 1;",
    "shared/domain/workspacePath.ts": "export const WorkspacePath = 1;",
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "domain-forbidden-dependency",
    );

    assert.deepEqual(
      violations.map(({ specifier }) => specifier),
      [
        "@/features/alpha/application/useCase",
        "@/features/beta",
        "@/shared/ui/SharedView",
      ],
    );
  } finally {
    removeFixture(root);
  }
});

test("cross-feature dependencies must use the target feature public API", () => {
  const root = createFixture({
    "features/alpha/application/useCase.ts": `
      import { publicValue } from "@/features/beta";
      import { privateValue } from "@/features/beta/domain/privateValue";
      export const values = [publicValue, privateValue];
    `,
    "features/beta/index.ts": "export const publicValue = 1;",
    "features/beta/domain/privateValue.ts": "export const privateValue = 2;",
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "cross-feature-deep-import",
    );

    assert.equal(violations.length, 1);
    assert.equal(
      violations[0].specifier,
      "@/features/beta/domain/privateValue",
    );
  } finally {
    removeFixture(root);
  }
});

test("app composition also uses feature public APIs for alias and relative imports", () => {
  const root = createFixture({
    "app/composition.ts": `
      import { publicValue } from "../features/beta";
      import { privateValue } from "@/features/beta/domain/privateValue";
      export const values = [publicValue, privateValue];
    `,
    "features/beta/index.ts": "export const publicValue = 1;",
    "features/beta/domain/privateValue.ts": "export const privateValue = 2;",
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "cross-feature-deep-import",
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0].source, "app/composition.ts");
    assert.equal(
      violations[0].specifier,
      "@/features/beta/domain/privateValue",
    );
  } finally {
    removeFixture(root);
  }
});

test("aggregate feature barrels are forbidden for shared and app consumers", () => {
  const root = createFixture({
    "app/composition.ts":
      'import { value } from "@/features"; export { value };',
    "features/index.ts": "export const value = 1;",
    "shared/lib/example.ts":
      'import { value } from "@/features"; export { value };',
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });

    assert.equal(
      audit.violations.filter(
        ({ rule }) => rule === "cross-feature-deep-import",
      ).length,
      1,
    );
    assert.equal(
      audit.violations.filter(
        ({ rule }) => rule === "shared-feature-dependency",
      ).length,
      1,
    );
  } finally {
    removeFixture(root);
  }
});

test("alias paths are canonicalized before feature ownership is classified", () => {
  const root = createFixture({
    "features/alpha/application/useCase.ts": `
      import { privateValue } from "@/features/alpha/../../features/beta/domain/privateValue";
      export const value = privateValue;
    `,
    "features/beta/domain/privateValue.ts": "export const privateValue = 2;",
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "cross-feature-deep-import",
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0].source, "features/alpha/application/useCase.ts");
  } finally {
    removeFixture(root);
  }
});

test("alias paths that leave and re-enter the source root are canonicalized", () => {
  const root = createFixture({
    "features/beta/domain/privateValue.ts": "export const privateValue = 2;",
  });
  const sourceRootName = path.basename(root);
  const sourcePath = path.join(root, "features/alpha/application/useCase.ts");
  mkdirSync(path.dirname(sourcePath), { recursive: true });
  writeFileSync(
    sourcePath,
    `
      import { privateValue } from "@/../${sourceRootName}/features/beta/domain/privateValue";
      export const value = privateValue;
    `,
  );

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "cross-feature-deep-import",
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0].source, "features/alpha/application/useCase.ts");
  } finally {
    removeFixture(root);
  }
});

test("alias paths with a redundant leading slash stay anchored to the source root", () => {
  const root = createFixture({
    "features/alpha/application/useCase.ts": `
      import { privateValue } from "@//features/beta/domain/privateValue";
      export const value = privateValue;
    `,
    "features/beta/domain/privateValue.ts": "export const privateValue = 2;",
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "cross-feature-deep-import",
    );

    assert.equal(violations.length, 1);
    assert.equal(violations[0].source, "features/alpha/application/useCase.ts");
  } finally {
    removeFixture(root);
  }
});

test("shared-to-feature dependencies require an exact issue-owned waiver", () => {
  const files = {
    "features/alpha/index.ts": "export const featureValue = 1;",
    "shared/lib/example.ts": `
      import { featureValue } from "@/features/alpha";
      export const value = featureValue;
    `,
  };
  const root = createFixture(files);

  try {
    const initial = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: [],
    });
    const violation = initial.violations.find(
      ({ rule }) => rule === "shared-feature-dependency",
    );
    assert.ok(violation);

    const waiver = {
      rule: violation.rule,
      source: violation.source,
      specifier: violation.specifier,
      issue: 106,
    };
    const waived = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: [waiver],
    });
    assert.equal(
      waived.violations.some(
        ({ rule }) => rule === "shared-feature-dependency",
      ),
      false,
    );
    assert.deepEqual(waived.staleWaivers, []);

    writeFileSync(
      path.join(root, "shared/lib/example.ts"),
      "export const value = 1;",
    );
    const stale = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: [waiver],
    });
    assert.deepEqual(stale.staleWaivers.map(violationKey), [
      violationKey(waiver),
    ]);
  } finally {
    removeFixture(root);
  }
});

test("raw Tauri core transport is owned only by invokeTauriCommand", () => {
  const root = createFixture({
    "features/alpha/infra/tauri/command.ts": `
      import { invoke } from "@tauri-apps/api/core";
      export const command = () => invoke("alpha_command");
    `,
    "shared/api/tauri/invokeTauriCommand.ts": `
      import { invoke } from "@tauri-apps/api/core";
      export const invokeTauriCommand = (name) => invoke(name);
    `,
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const violations = audit.violations.filter(
      ({ rule }) => rule === "raw-tauri-core-dependency",
    );

    assert.deepEqual(
      violations.map(({ source, specifier }) => ({ source, specifier })),
      [
        {
          source: "features/alpha/infra/tauri/command.ts",
          specifier: "@tauri-apps/api/core",
        },
      ],
    );
  } finally {
    removeFixture(root);
  }
});

test("package dependency cycles are reported as package-level edges", () => {
  const root = createFixture({
    "features/alpha/index.ts": `
      import { sharedValue } from "@/shared/lib/example";
      export const featureValue = sharedValue;
    `,
    "shared/lib/example.ts": `
      import { featureValue } from "@/features/alpha";
      export const sharedValue = featureValue;
    `,
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    const cycles = audit.violations.filter(
      ({ rule }) => rule === "package-cycle-dependency",
    );

    assert.deepEqual(
      cycles.map(({ source, specifier }) => [source, specifier]),
      [
        ["features/alpha", "shared"],
        ["shared", "features/alpha"],
      ],
    );
  } finally {
    removeFixture(root);
  }
});

test("test, story, and testing-support files do not create production dependencies", () => {
  const root = createFixture({
    "features/alpha/index.ts": "export const featureValue = 1;",
    "shared/lib/example.test.ts": 'import "@/features/alpha/domain/private";',
    "shared/ui/Example.stories.tsx":
      'import "@/features/alpha/domain/private";',
    "shared/testing/example.ts": 'import "@/features/alpha/domain/private";',
  });

  try {
    const audit = auditFrontendArchitecture({ sourceRoot: root, waivers: [] });
    assert.deepEqual(audit.violations, []);
  } finally {
    removeFixture(root);
  }
});

test("malformed and duplicate waivers fail configuration validation", () => {
  const root = createFixture({
    "features/alpha/index.ts": "export const featureValue = 1;",
  });
  const waiver = {
    rule: "shared-feature-dependency",
    source: "shared/lib/example.ts",
    specifier: "@/features/alpha",
    issue: 0,
  };

  try {
    const audit = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: [waiver, waiver],
    });

    assert.equal(audit.configurationErrors.length, 2);
  } finally {
    removeFixture(root);
  }
});

test("duplicate valid waivers fail configuration validation", () => {
  const root = createFixture({
    "features/alpha/index.ts": "export const featureValue = 1;",
  });
  const waiver = {
    rule: "shared-feature-dependency",
    source: "shared/lib/example.ts",
    specifier: "@/features/alpha",
    issue: 106,
  };

  try {
    const audit = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: [waiver, waiver],
    });

    assert.deepEqual(audit.configurationErrors, [
      `Duplicate waiver: ${violationKey(waiver)}`,
    ]);
  } finally {
    removeFixture(root);
  }
});

test("waiver collection and entries have a validated document shape", () => {
  const root = createFixture({
    "features/alpha/index.ts": "export const featureValue = 1;",
  });

  try {
    const invalidCollection = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: null,
    });
    assert.deepEqual(invalidCollection.configurationErrors, [
      "Waivers must be an array.",
    ]);

    const invalidEntry = auditFrontendArchitecture({
      sourceRoot: root,
      waivers: [null],
    });
    assert.deepEqual(invalidEntry.configurationErrors, [
      "Invalid waiver: null",
    ]);
  } finally {
    removeFixture(root);
  }
});
