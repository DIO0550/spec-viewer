import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function seedConvergedComments(page: Page): Promise<void> {
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
        revision: "3",
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
            false,
            "2026-08-11T00:00:01Z",
          ),
          createComment(
            "converged-c",
            "converged resolved",
            true,
            "2026-08-11T00:00:02Z",
          ),
        ],
        resolutionWarnings: [],
      }),
    );
  });
}

export async function expectNoSeriousAccessibilityViolations(
  page: Page,
): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
}

export async function openWorkspace(page: Page, root: string): Promise<void> {
  const input = page.getByRole("textbox", { name: "PATH" });
  await input.fill(root);
  await input.press("Enter");
  await expect(page.getByRole("tab", { name: "Diff" })).toBeEnabled();
}

export async function openRepositoryFile(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Diff" }).click();
  await page
    .getByRole("treeitem")
    .filter({ hasText: "implementation-plan.md" })
    .click();
  await expect(page.getByRole("radio", { name: "Unified" })).toBeEnabled();
}

export async function openComposer(
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

export async function installStatefulInvokeBoundary(page: Page): Promise<void> {
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
          if (localStorage.getItem("e2e-spec-archived") === "true") {
            return {
              specs: [
                {
                  id: "primary/.archive",
                  label: "Archive",
                  kind: "archive",
                  sourceGroupId: "primary",
                  relativeId: ".archive",
                  presentDocumentCount: 1,
                  descendantSpecCount: 1,
                  files: [],
                  children: [
                    {
                      id: "198-diff-comments",
                      label: "198-diff-comments",
                      kind: "spec",
                      sourceGroupId: "primary",
                      relativeId: ".archive/198-diff-comments",
                      presentDocumentCount: 1,
                      descendantSpecCount: 0,
                      files: [],
                      children: [],
                    },
                  ],
                },
              ],
            };
          }
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
                contents: "# Implementation\n\nReview section",
                blocks: [
                  {
                    blockType: "heading",
                    blockIndex: 0,
                    textHash: "fnv1a:c6ea9587",
                    textSnippet: "Implementation",
                    sourceRange: null,
                  },
                  {
                    blockType: "paragraph",
                    blockIndex: 1,
                    textHash: "fnv1a:a5fe9706",
                    textSnippet: "Review section",
                    sourceRange: null,
                  },
                ],
                error: null,
              },
              {
                identity: { kind: "standard", fileKey: "tasks" },
                fileKey: "tasks",
                fileName: "tasks.md",
                label: "Tasks",
                format: "markdown",
                progress: "inProgress",
                path: `${String(request.workspacePath)}/tasks.md`,
                contents: "- [ ] Regression",
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
        if (command === "archive_spec") {
          localStorage.setItem("e2e-spec-archived", "true");
          localStorage.setItem(
            "e2e-archive-count",
            String(
              Number(localStorage.getItem("e2e-archive-count") ?? "0") + 1,
            ),
          );
          return {
            archivedSpecId: String(request.specId),
            archivePath: `${String(request.workspacePath)}/.plugin-workspace/.specs/.archive/${String(request.specId)}`,
            sourceGroupId: "primary",
            destinationNodeId: `.archive/${String(request.specId)}`,
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
          if (localStorage.getItem("e2e-stale-save-once") === "true") {
            localStorage.removeItem("e2e-stale-save-once");
            localStorage.setItem("e2e-new-snapshot", "true");
            throw {
              code: "staleSnapshot",
              message: "stale snapshot",
            };
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
            comments: current.comments
              .filter(
                (comment) =>
                  request.deleted !== true || comment.id !== request.commentId,
              )
              .map((comment) =>
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
          const comments = JSON.parse(
            localStorage.getItem("e2e-spec-comments") ?? "[]",
          ) as readonly Record<string, unknown>[];
          return {
            comments:
              request.statusFilter === "all"
                ? comments
                : comments.filter(
                    (comment) => comment.status === request.statusFilter,
                  ),
          };
        }
        if (command === "add_comment") {
          const comments = JSON.parse(
            localStorage.getItem("e2e-spec-comments") ?? "[]",
          ) as readonly Record<string, unknown>[];
          const comment = {
            id: `spec-comment-${comments.length + 1}`,
            anchor: request.anchor,
            body: request.body,
            status: "open",
            anchorResolution: { status: "exact" },
            createdAt: "2026-08-11T00:00:00Z",
            updatedAt: "2026-08-11T00:00:00Z",
          };
          localStorage.setItem(
            "e2e-spec-comments",
            JSON.stringify([...comments, comment]),
          );
          return comment;
        }
        if (command === "resolve_comment" || command === "reopen_comment") {
          const comments = JSON.parse(
            localStorage.getItem("e2e-spec-comments") ?? "[]",
          ) as readonly Record<string, unknown>[];
          const next = comments.map((comment) =>
            comment.id === request.commentId
              ? {
                  ...comment,
                  status: command === "resolve_comment" ? "resolved" : "open",
                  updatedAt: "2026-08-11T00:00:01Z",
                }
              : comment,
          );
          localStorage.setItem("e2e-spec-comments", JSON.stringify(next));
          return next.find((comment) => comment.id === request.commentId);
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
