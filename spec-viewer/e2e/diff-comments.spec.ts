import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await installStatefulInvokeBoundary(page);
  await page.goto("/");
  await openWorkspace(page, "/workspace/worktree-a");
});

test("actual Appでworkspace tree tab mode Reviewを通して作成・resolve・jumpする", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await openComposer(page, "base", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Review from actual App");
  await composer.press("Control+Enter");

  await expect(page.getByText("Review from actual App")).toBeVisible();
  await page.getByRole("button", { name: /^Resolve comment-/ }).click();
  await page.getByRole("button", { name: /^Resolved 1$/ }).click();
  await expect(page.getByText("Review from actual App")).toBeVisible();

  await page.getByRole("radio", { name: "Editor" }).click();
  await page.getByRole("button", { name: /2行目へ移動/ }).click();
  await expect(page.getByRole("radio", { name: "Unified" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.getByRole("radio", { name: "Split" }).click();
  await expect(page.getByRole("radio", { name: "Split" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("actual AppでCAS conflict draftを保持しreloadとA-B-Aでidentityを分離する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() => localStorage.setItem("e2e-conflict-once", "true"));
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("Conflict-safe draft");
  await composer.press("Control+Enter");
  await expect(page.getByRole("alert")).toContainText("競合");
  await expect(composer).toHaveValue("Conflict-safe draft");
  await composer.press("Control+Enter");
  await expect(page.getByText("Conflict-safe draft")).toBeVisible();

  await openWorkspace(page, "/workspace/worktree-b");
  await openRepositoryFile(page);
  await expect(page.getByText("Conflict-safe draft")).toBeHidden();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(page.getByText("Conflict-safe draft")).toBeVisible();

  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(page.getByText("Conflict-safe draft")).toBeVisible();
});

test("actual AppでstaleTarget・overflow・indicator-card・keyboard/themeを表現する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await expectNoSeriousAccessibilityViolations(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("stale draft");
  await page.evaluate(() => localStorage.setItem("e2e-new-snapshot", "true"));
  await page.getByRole("button", { name: "現在の表示を再読み込み" }).click();
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("再アンカー");
  await page.getByRole("button", { name: "再アンカー" }).click();
  await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
  await page.getByRole("button", { name: "キャンセル" }).click();

  await page.evaluate(() => localStorage.setItem("e2e-overflow-once", "true"));
  await openComposer(page, "current", 2);
  const overflowComposer = page.getByRole("textbox", {
    name: /2行目へのコメント/,
  });
  await overflowComposer.fill("overflow draft");
  await overflowComposer.press("Control+Enter");
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("revision上限");
  await page.getByRole("button", { name: "キャンセル" }).click();

  await page.getByLabel("テーマモード").selectOption("dark");
  await expectNoSeriousAccessibilityViolations(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Unified" }).press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Split" })).toBeFocused();
});

test("actual AppでEnter Esc IMEとbase draftのEditor hide/Unified restoreを保つ", async ({
  page,
}) => {
  await openRepositoryFile(page);
  const origin = page.getByRole("button", {
    name: /old-plan\.md base 2行目にコメントを追加/,
  });
  await origin.click();
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("first");
  await composer.press("Enter");
  await expect(composer).toHaveValue("first\n");

  await composer.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        ctrlKey: true,
        isComposing: true,
        bubbles: true,
      }),
    );
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        isComposing: true,
        bubbles: true,
      }),
    );
  });
  await expect(composer).toBeVisible();
  await expect(page.locator("article[data-comment-id]")).toHaveCount(0);

  await page.getByRole("radio", { name: "Editor" }).click();
  await expect(composer).toBeHidden();
  await page.getByRole("radio", { name: "Unified" }).click();
  await expect(composer).toHaveValue("first\n");
  await composer.press("Escape");
  await expect(composer).toBeHidden();
  await expect(origin).toBeFocused();
});

test("actual Appでpending A-B-A settlementをorigin identityへ隔離する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() =>
    localStorage.setItem("e2e-delay-save-once", "true"),
  );
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("pending A only");
  await composer.press("Control+Enter");

  await openWorkspace(page, "/workspace/worktree-b");
  await openRepositoryFile(page);
  await expect(page.getByText("pending A only")).toBeHidden();
  await page.waitForTimeout(350);
  await expect(page.getByText("pending A only")).toBeHidden();

  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await expect(page.getByText("pending A only")).toBeVisible();
});

test("actual Appでpermission recoveryとcommitted uncertaintyを区別する", async ({
  page,
}) => {
  await openRepositoryFile(page);
  await page.evaluate(() =>
    localStorage.setItem("e2e-permission-once", "true"),
  );
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("copyable permission draft");
  await composer.press("Control+Enter");
  await expect(composer).toHaveValue("copyable permission draft");
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("権限");
  await expect(page.getByRole("button", { name: "保存を再試行" })).toBeHidden();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "Diff commentsを再読み込み" }).click();
  await expect(
    page.getByRole("button", { name: "Diff commentsを再読み込み" }),
  ).toBeEnabled();

  await page.evaluate(() => localStorage.setItem("e2e-uncertain-once", "true"));
  await openComposer(page, "current", 2);
  const uncertainComposer = page.getByRole("textbox", {
    name: /2行目へのコメント/,
  });
  await uncertainComposer.fill("committed uncertain");
  await uncertainComposer.press("Control+Enter");
  await expect(page.getByText("committed uncertain")).toBeVisible();
  await expect(page.getByText(/永続化の確認が不確実/)).toBeVisible();
  await expect(uncertainComposer).toBeHidden();
  await expect(page.getByRole("button", { name: "保存を再試行" })).toBeHidden();
});

test("actual Appでconvergence pickerがfilter/searchを解除しcardを選択する", async ({
  page,
}) => {
  await seedConvergedComments(page);
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await page.getByRole("button", { name: "Resolved 1" }).click();
  const search = page.getByRole("searchbox", { name: "コメントを検索" });
  await search.fill("no-match");
  await expect(
    page.getByText("条件に一致するコメントはありません"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "implementation-plan.md current 2行目のコメント2件を選択",
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "converged first" }),
  ).toBeFocused();
  await page.getByRole("menuitem", { name: "converged second" }).click();
  await expect(page.getByRole("button", { name: "All 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(search).toHaveValue("");
  await expect(
    page.locator('[data-comment-id="converged-b"].review-comment__select'),
  ).toHaveAttribute("aria-current", "true");
});
test("actual Appでhidden copy pathのbase/current card jumpを復元する", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem("e2e-hidden-copy", "true"));
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("tab", { name: "Diff" }).click();
  const directory = page.getByRole("treeitem").filter({
    has: page.locator(".repository-diff-tree__name", {
      hasText: /^reviews$/,
    }),
  });
  await directory.click();
  await page.getByRole("treeitem").filter({ hasText: "copy-plan.md" }).click();

  await openComposer(page, "base", 2, "old-copy");
  let composer = page.getByRole("textbox", { name: /base 2行目へのコメント/ });
  await composer.fill("hidden copy base");
  await composer.press("Control+Enter");
  await openComposer(page, "current", 2, "reviews/copy-plan");
  composer = page.getByRole("textbox", { name: /current 2行目へのコメント/ });
  await composer.fill("hidden copy current");
  await composer.press("Control+Enter");

  await directory.click();
  await expect(
    page.getByRole("treeitem").filter({ hasText: "copy-plan.md" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: /old-copy\.md base 2行目へ移動/ })
    .click();
  await expect(
    page.getByRole("button", {
      name: /old-copy\.md base 2行目のコメントを選択/,
    }),
  ).toHaveAttribute("aria-current", "true");
  await page
    .getByRole("button", {
      name: /reviews\/copy-plan\.md current 2行目へ移動/,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: /reviews\/copy-plan\.md current 2行目のコメントを選択/,
    }),
  ).toHaveAttribute("aria-current", "true");
});
test("actual AppでAll unchanged current lineをsave reload jumpする", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Diff" }).click();
  await page.getByRole("tab", { name: "All" }).click();
  await page.getByRole("treeitem").filter({ hasText: "notes.md" }).click();
  await page.getByRole("radio", { name: "Editor" }).click();
  await openComposer(page, "current", 2, "notes");
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("unchanged All persisted");
  await composer.press("Control+Enter");
  await expect(page.getByText("unchanged All persisted")).toBeVisible();

  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await page.getByRole("tab", { name: "Diff" }).click();
  await page.getByRole("tab", { name: "All" }).click();
  await expect(page.getByText("unchanged All persisted")).toBeVisible();
  await page
    .getByRole("button", { name: /notes\.md current 2行目へ移動/ })
    .click();
  await expect(page.getByRole("tab", { name: /notes\.md/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("button", {
      name: "notes.md current 2行目のコメント1件を表示",
    }),
  ).toHaveAttribute("aria-current", "true");
});

test("actual AppでstoreBusyとioはdraftを保持してretryできinvalidStoreは恒久blockする", async ({
  page,
}) => {
  await openRepositoryFile(page);
  for (const scenario of [
    { failure: "storeBusy" as const, side: "current" as const, line: 2 },
    { failure: "io" as const, side: "base" as const, line: 2 },
  ]) {
    await page.evaluate(
      (code) => localStorage.setItem(`e2e-${code}-once`, "true"),
      scenario.failure,
    );
    await openComposer(page, scenario.side, scenario.line);
    const composer = page.getByRole("textbox", {
      name: new RegExp(`${scenario.side} ${scenario.line}行目へのコメント`),
    });
    await composer.fill(`${scenario.failure} retry body`);
    await composer.press("Control+Enter");
    await expect(composer).toHaveValue(`${scenario.failure} retry body`);
    await expect(
      page.getByRole("button", { name: "保存を再試行" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "保存を再試行" }).click();
    await expect(
      page.getByText(`${scenario.failure} retry body`),
    ).toBeVisible();
  }

  await page.evaluate(() =>
    localStorage.setItem("e2e-invalidStore-once", "true"),
  );
  await openComposer(page, "current", 1);
  const invalidComposer = page.getByRole("textbox", {
    name: /current 1行目へのコメント/,
  });
  await invalidComposer.fill("invalid store body");
  await invalidComposer.press("Control+Enter");
  await expect(invalidComposer).toHaveValue("invalid store body");
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await invalidComposer.press("Escape");
  await openComposer(page, "current", 3);
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
});

test("actual Appでrelocatedだけjump可能、staleは非jumpでexport操作を公開しない", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem("e2e-resolution-cards", "true"),
  );
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);

  await expect(page.getByText("relocated body")).toBeVisible();
  await page
    .getByRole("button", {
      name: /implementation-plan\.md current 2行目へ移動/,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "implementation-plan.md current 2行目のコメント1件を表示",
    }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", {
      name: /implementation-plan\.md current 3行目へ移動/,
    }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /export/i })).toHaveCount(0);
});

test("actual Appでfoldedかつwindow外のtargetを展開してfocusする", async ({
  page,
}) => {
  await page.evaluate(() => localStorage.setItem("e2e-folded-target", "true"));
  await page.reload();
  await openWorkspace(page, "/workspace/worktree-a");
  await openRepositoryFile(page);
  await page
    .getByRole("button", {
      name: /implementation-plan\.md current 150行目へ移動/,
    })
    .click();

  await expect(
    page.getByRole("button", {
      name: "implementation-plan.md current 150行目のコメント1件を表示",
    }),
  ).toBeFocused();
  await expect(page.getByRole("row", { name: /省略/ })).toHaveCount(0);
});

test("actual Appでsnapshot stale draftをdiscardできる", async ({ page }) => {
  await openRepositoryFile(page);
  await openComposer(page, "current", 2);
  const composer = page.getByRole("textbox", { name: /2行目へのコメント/ });
  await composer.fill("discard stale body");
  await page.evaluate(() => localStorage.setItem("e2e-new-snapshot", "true"));
  await page.getByRole("button", { name: "現在の表示を再読み込み" }).click();
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(composer).toBeHidden();
});
async function seedConvergedComments(page: Page): Promise<void> {
  await page.evaluate(() => {
    const repositoryId = `rr1_${"a".repeat(64)}`;
    const worktreeId = `rw1_${"f".repeat(64)}`;
    const identity = {
      repositoryId,
      worktreeId,
      baseSha: "b".repeat(40),
      currentSnapshotId: `rs1_${"d".repeat(64)}`,
    };
    const resolution = {
      status: "exact",
      selectionPath: "implementation-plan.md",
      sidePath: "implementation-plan.md",
      side: "current",
      line: 2,
    };
    const createComment = (
      id: string,
      body: string,
      resolved: boolean,
      createdAt: string,
    ) => ({
      id,
      body,
      resolved,
      createdAt,
      anchor: {
        ...identity,
        side: "current",
        oldPath: "old-plan.md",
        newPath: "implementation-plan.md",
        line: 2,
        lineHash: `sha256:${"9".repeat(64)}`,
        snippet: "current",
        contextBefore: ["first"],
        contextAfter: ["last"],
      },
      anchorResolution: resolution,
    });
    localStorage.setItem(
      `e2e-diff-comments:${repositoryId}:${worktreeId}`,
      JSON.stringify({
        version: 1,
        repositoryId,
        worktreeId,
        revision: "2",
        comments: [
          createComment(
            "converged-a",
            "converged first",
            false,
            "2026-08-11T00:00:00Z",
          ),
          createComment(
            "converged-b",
            "converged second",
            true,
            "2026-08-11T00:00:01Z",
          ),
        ],
        resolutionWarnings: [],
      }),
    );
  });
}

async function expectNoSeriousAccessibilityViolations(
  page: Page,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

async function openWorkspace(page: Page, root: string): Promise<void> {
  const input = page.getByRole("textbox", { name: "PATH" });
  await input.fill(root);
  await input.press("Enter");
  await expect(page.getByRole("tab", { name: "Diff" })).toBeEnabled();
}

async function openRepositoryFile(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Diff" }).click();
  await page
    .getByRole("treeitem")
    .filter({ hasText: "implementation-plan.md" })
    .click();
  await expect(page.getByRole("radio", { name: "Unified" })).toBeEnabled();
}

async function openComposer(
  page: Page,
  side: "base" | "current",
  line: number,
  path = side === "base" ? "old-plan" : "implementation-plan",
): Promise<void> {
  await page
    .getByRole("button", {
      name: new RegExp(`${path}\\.md ${side} ${line}行目`),
    })
    .click();
}

async function installStatefulInvokeBoundary(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Identity = Readonly<{
      repositoryId: string;
      worktreeId: string;
      baseSha: string;
      currentSnapshotId: string;
    }>;
    type Document = Readonly<{
      version: 1;
      repositoryId: string;
      worktreeId: string;
      revision: string;
      comments: readonly Record<string, unknown>[];
      resolutionWarnings: readonly Record<string, unknown>[];
    }>;
    const repositoryId = `rr1_${"a".repeat(64)}`;
    const baseSha = "b".repeat(40);
    const snapshotId = (root: string): string => {
      if (root.endsWith("-b")) {
        return `rs1_${"c".repeat(64)}`;
      }
      const hashCharacter =
        localStorage.getItem("e2e-new-snapshot") === "true" ? "8" : "d";
      return `rs1_${hashCharacter.repeat(64)}`;
    };
    const worktreeId = (root: string): string =>
      `rw1_${(root.endsWith("-b") ? "e" : "f").repeat(64)}`;
    const identity = (root: string): Identity => ({
      repositoryId,
      worktreeId: worktreeId(root),
      baseSha,
      currentSnapshotId: snapshotId(root),
    });
    const file = {
      oldPath: "old-plan.md",
      newPath: "implementation-plan.md",
      change: "renamed",
      entryKind: "regular",
      contentClassification: "text",
      similarity: 90,
      oldMode: "100644",
      newMode: "100644",
    };
    const copyFile = {
      ...file,
      oldPath: "old-copy.md",
      newPath: "reviews/copy-plan.md",
      change: "copied",
    };
    const treeFile = {
      path: "implementation-plan.md",
      name: "implementation-plan.md",
      kind: "file",
      entryKind: "regular",
      change: "renamed",
      ignored: false,
      children: { state: "loaded", items: [] },
    };
    const copyTreeFile = {
      ...treeFile,
      path: "reviews/copy-plan.md",
      name: "copy-plan.md",
      change: "copied",
    };
    const copyTree = {
      path: "reviews",
      name: "reviews",
      kind: "directory",
      entryKind: null,
      change: null,
      ignored: false,
      children: { state: "loaded", items: [copyTreeFile] },
    };
    const unchangedTreeFile = {
      path: "notes.md",
      name: "notes.md",
      kind: "file",
      entryKind: "regular",
      change: null,
      ignored: false,
      children: { state: "loaded", items: [] },
    };
    const storageKey = (scope: Pick<Identity, "repositoryId" | "worktreeId">) =>
      `e2e-diff-comments:${scope.repositoryId}:${scope.worktreeId}`;
    const emptyDocument = (scope: Identity): Document => ({
      version: 1,
      repositoryId: scope.repositoryId,
      worktreeId: scope.worktreeId,
      revision: "0",
      comments: [],
      resolutionWarnings: [],
    });
    const seededResolutionDocument = (scope: Identity): Document => {
      const folded = localStorage.getItem("e2e-folded-target") === "true";
      const createSeed = (
        id: string,
        body: string,
        line: number,
        anchorResolution: Record<string, unknown>,
      ) => ({
        id,
        body,
        resolved: false,
        createdAt: "2026-08-11T00:00:00Z",
        anchor: {
          ...scope,
          side: "current",
          oldPath: "old-plan.md",
          newPath: "implementation-plan.md",
          line,
          lineHash: `sha256:${"9".repeat(64)}`,
          snippet: `context ${line}`,
          contextBefore: [],
          contextAfter: [],
        },
        anchorResolution,
      });
      if (folded) {
        return {
          ...emptyDocument(scope),
          revision: "1",
          comments: [
            createSeed("folded", "folded body", 150, {
              status: "exact",
              selectionPath: "implementation-plan.md",
              sidePath: "implementation-plan.md",
              side: "current",
              line: 150,
            }),
          ],
        };
      }
      return {
        ...emptyDocument(scope),
        revision: "2",
        comments: [
          createSeed("relocated", "relocated body", 2, {
            status: "relocated",
            selectionPath: "implementation-plan.md",
            sidePath: "implementation-plan.md",
            side: "current",
            line: 2,
          }),
          createSeed("stale", "stale body", 3, {
            status: "stale",
            reason: "contextNotFound",
            candidateCount: 0,
          }),
        ],
      };
    };
    const load = (scope: Identity): Document => {
      const stored = localStorage.getItem(storageKey(scope));
      if (stored !== null) {
        return JSON.parse(stored) as Document;
      }
      if (
        localStorage.getItem("e2e-resolution-cards") === "true" ||
        localStorage.getItem("e2e-folded-target") === "true"
      ) {
        return seededResolutionDocument(scope);
      }
      return emptyDocument(scope);
    };
    const persist = (document: Document): void => {
      localStorage.setItem(storageKey(document), JSON.stringify(document));
    };
    const committed = (document: Document) => ({
      kind: "committed",
      document,
      revision: document.revision,
      resolutionWarnings: document.resolutionWarnings,
      durability: "durable",
    });

    window.__TAURI_INTERNALS__ = {
      ...window.__TAURI_INTERNALS__,
      invoke: async (command: string, args?: Record<string, unknown>) => {
        const request = (args?.request ?? {}) as Record<string, unknown>;
        if (command === "load_workspace") {
          const root = String(request.selectedDirectory);
          return {
            root,
            kind: "plugin-worktree",
            files: [
              {
                key: "impl",
                label: "Implementation",
                fileName: "implementation-plan.md",
              },
            ],
          };
        }
        if (command === "list_specs") {
          return {
            specs: [
              {
                id: "198-diff-comments",
                label: "198-diff-comments",
                kind: "spec",
                sourceGroupId: "primary",
                relativeId: "198-diff-comments",
                presentDocumentCount: 1,
                descendantSpecCount: 0,
                files: [
                  {
                    key: "impl",
                    label: "Implementation",
                    fileName: "implementation-plan.md",
                    status: "present",
                    format: "markdown",
                  },
                ],
                children: [],
              },
            ],
          };
        }
        if (command === "load_spec_bundle") {
          return {
            specId: "198-diff-comments",
            progress: "unknown",
            artifacts: [
              {
                identity: { kind: "standard", fileKey: "impl" },
                fileKey: "impl",
                fileName: "implementation-plan.md",
                label: "Implementation",
                format: "markdown",
                progress: "unknown",
                path: `${String(request.workspacePath)}/implementation-plan.md`,
                contents: "",
                blocks: [],
                error: null,
              },
            ],
          };
        }
        if (command === "read_spec_file") {
          return {
            key: "impl",
            format: "markdown",
            path: `${String(request.workspacePath)}/implementation-plan.md`,
            contents: "# Implementation",
            missing: false,
            blocks: [],
          };
        }
        if (command === "list_spec_diff_revisions") {
          return {
            options: [
              {
                revision: { kind: "head" },
                label: "HEAD",
                resolvedCommitSha: baseSha,
              },
            ],
          };
        }
        if (command === "load_repository_diff") {
          const root = String(request.worktreeId);
          const scope = identity(root);
          const isHiddenCopy =
            localStorage.getItem("e2e-hidden-copy") === "true";
          const activeFile = isHiddenCopy ? copyFile : file;
          const activeTree = isHiddenCopy ? copyTree : treeFile;
          const activePath = activeFile.newPath;
          return {
            repositoryId,
            base: {
              state: "resolved",
              source: "main",
              branchRef: "refs/heads/main",
              mergeBaseSha: baseSha,
              headSha: "1".repeat(40),
              reason: null,
              candidates: [],
              overrideRef: null,
            },
            currentSnapshotId: scope.currentSnapshotId,
            diffReviewIdentity: scope,
            displayWorktreeLabel: root.endsWith("-b")
              ? "Worktree B"
              : "Worktree A",
            changed: [activeFile],
            changedTree: [activeTree],
            allRoot: [activeTree, unchangedTreeFile],
            all: [activePath, "notes.md"],
            ignoredDirectories: [],
            warnings: [],
          };
        }
        if (command === "load_repository_file") {
          if (request.path === "notes.md") {
            return {
              file: {
                oldPath: null,
                newPath: "notes.md",
                change: null,
                entryKind: "regular",
                contentClassification: "text",
                similarity: null,
                oldMode: null,
                newMode: null,
              },
              oldContent: {
                state: "omitted",
                text: null,
                reason: "missingSide",
                byteLength: null,
              },
              newContent: {
                state: "available",
                text: "unchanged first\nunchanged second",
                reason: null,
                byteLength: null,
              },
              patch: {
                state: "available",
                text: "",
                reason: null,
                byteLength: null,
              },
              structuredDiff: { state: "available", reason: null, hunks: [] },
              submodule: null,
            };
          }
          if (localStorage.getItem("e2e-folded-target") === "true") {
            const context = Array.from(
              { length: 200 },
              (_, index) => `context ${index + 1}`,
            );
            return {
              file,
              oldContent: {
                state: "available",
                text: context.join("\n"),
                reason: null,
                byteLength: null,
              },
              newContent: {
                state: "available",
                text: context.join("\n"),
                reason: null,
                byteLength: null,
              },
              patch: {
                state: "available",
                text: "@@ -1,200 +1,200 @@",
                reason: null,
                byteLength: null,
              },
              structuredDiff: {
                state: "available",
                reason: null,
                hunks: [
                  {
                    header: "@@ -1,200 +1,200 @@",
                    lines: context.map((text) => ({ kind: "context", text })),
                  },
                ],
              },
              submodule: null,
            };
          }
          const activeFile =
            localStorage.getItem("e2e-hidden-copy") === "true"
              ? copyFile
              : file;
          return {
            file: activeFile,
            oldContent: {
              state: "available",
              text: "first\nold\nlast",
              reason: null,
              byteLength: null,
            },
            newContent: {
              state: "available",
              text: "first\ncurrent\nlast",
              reason: null,
              byteLength: null,
            },
            patch: {
              state: "available",
              text: "@@ -1,3 +1,3 @@",
              reason: null,
              byteLength: null,
            },
            structuredDiff: {
              state: "available",
              reason: null,
              hunks: [
                {
                  header: "@@ -1,3 +1,3 @@",
                  lines: [
                    { kind: "context", text: "first" },
                    { kind: "removed", text: "old" },
                    { kind: "added", text: "current" },
                    { kind: "context", text: "last" },
                  ],
                },
              ],
            },
            submodule: null,
          };
        }
        if (command === "load_diff_comments") {
          return load(request.identity as Identity);
        }
        if (
          command === "save_diff_comment" ||
          command === "update_diff_comment"
        ) {
          const scope = request.identity as Identity;
          const current = load(scope);
          if (localStorage.getItem("e2e-delay-save-once") === "true") {
            localStorage.removeItem("e2e-delay-save-once");
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          if (localStorage.getItem("e2e-permission-once") === "true") {
            localStorage.removeItem("e2e-permission-once");
            return {
              kind: "preCommitFailure",
              code: "permission",
              retryable: false,
            };
          }
          for (const code of ["storeBusy", "io", "invalidStore"] as const) {
            const key = `e2e-${code}-once`;
            if (localStorage.getItem(key) === "true") {
              localStorage.removeItem(key);
              return {
                kind: "preCommitFailure",
                code,
                retryable: code !== "invalidStore",
              };
            }
          }
          if (localStorage.getItem("e2e-conflict-once") === "true") {
            localStorage.removeItem("e2e-conflict-once");
            return {
              kind: "conflict",
              latestDocument: current,
              latestRevision: current.revision,
              resolutionWarnings: [],
            };
          }
          if (localStorage.getItem("e2e-overflow-once") === "true") {
            localStorage.removeItem("e2e-overflow-once");
            return {
              kind: "preCommitFailure",
              code: "revisionOverflow",
              currentDocument: current,
              currentRevision: current.revision,
              retryable: false,
            };
          }
          const revision = String(Number(current.revision) + 1);
          if (command === "save_diff_comment") {
            const target = request.target as Record<string, unknown>;
            const next: Document = {
              ...current,
              revision,
              comments: [
                ...current.comments,
                {
                  id: `comment-${revision}`,
                  body: request.body,
                  resolved: false,
                  createdAt: "2026-08-11T00:00:00Z",
                  anchor: {
                    ...scope,
                    side: target.side,
                    oldPath: target.oldPath,
                    newPath: target.newPath,
                    line: target.line,
                    lineHash: `sha256:${"9".repeat(64)}`,
                    snippet: "current",
                    contextBefore: ["first"],
                    contextAfter: ["last"],
                  },
                  anchorResolution: {
                    status: "exact",
                    selectionPath: String(target.newPath ?? target.oldPath),
                    sidePath:
                      target.side === "base" ? target.oldPath : target.newPath,
                    side: target.side,
                    line: target.line,
                  },
                },
              ],
            };
            persist(next);
            if (localStorage.getItem("e2e-uncertain-once") === "true") {
              localStorage.removeItem("e2e-uncertain-once");
              return {
                ...committed(next),
                durability: "uncertain",
              };
            }
            return committed(next);
          }
          const next: Document = {
            ...current,
            revision,
            comments: current.comments.map((comment) =>
              comment.id === request.commentId
                ? {
                    ...comment,
                    ...(request.body === undefined
                      ? {}
                      : { body: request.body }),
                    ...(request.resolved === undefined
                      ? {}
                      : { resolved: request.resolved }),
                  }
                : comment,
            ),
          };
          persist(next);
          return committed(next);
        }
        if (command === "list_changed_spec_files") {
          return {
            currentSnapshotId: snapshotId(String(request.workspacePath)),
            resolvedBaseSha: baseSha,
            files: [],
          };
        }
        if (command === "list_comments") {
          return { comments: [] };
        }
        if (command === "start_spec_file_watch") {
          return { watchId: "watch-e2e" };
        }
        if (command === "stop_spec_file_watch") {
          return null;
        }
        throw new Error(`Unexpected invoke command: ${command}`);
      },
    };
  });
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: Record<string, unknown> & {
      invoke?: (
        command: string,
        args?: Record<string, unknown>,
      ) => Promise<unknown>;
    };
  }
}
