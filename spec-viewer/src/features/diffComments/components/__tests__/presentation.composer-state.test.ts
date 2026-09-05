import { expect, test, vi } from "vitest";

import type { UseDiffCommentsResult } from "@/features/diffComments";
import { createDiffLineCommentsController } from "@/features/diffComments/components/presentation";

test("staleTargetとoverflowをcomposerへ伝えretry/reanchorをhook callerへ返す", () => {
  const retry = vi.fn().mockResolvedValue(true);
  const reanchorDraft = vi.fn();
  const state = createState({ retry, reanchorDraft });
  const controller = createDiffLineCommentsController({
    state,
    origin: null,
    onOriginChange: () => undefined,
    onRevealComment: () => undefined,
  });

  expect(controller.draft).toMatchObject({
    canSubmit: false,
    disabledReason: "staleTarget",
    canRetry: false,
    canReanchor: true,
    errorMessage: null,
  });
  controller.onRetryDraft?.();
  controller.onReanchorDraft?.(controller.draft!.target);

  expect(retry).toHaveBeenCalledOnce();
  expect(reanchorDraft).toHaveBeenCalledWith({
    side: "current",
    oldPath: "src/old.ts",
    newPath: "src/new.ts",
    line: 12,
  });
});

function createState(
  overrides: Pick<UseDiffCommentsResult, "retry" | "reanchorDraft">,
): UseDiffCommentsResult {
  return {
    session: {
      identity: {
        repositoryId: "repo",
        worktreeId: "worktree",
        baseSha: "base",
        currentSnapshotId: "snapshot",
      },
      loadState: "ready",
      revision: "18446744073709551615",
      comments: [],
      resolutionWarnings: [],
      filter: "all",
      search: "",
      selectedCommentId: null,
      draft: {
        state: "staleTarget",
        target: {
          side: "current",
          oldPath: "src/old.ts",
          newPath: "src/new.ts",
          line: 12,
        },
        body: "draft",
        canSubmit: false,
        disabledReason: "staleTarget",
      },
      mutation: {
        state: "preCommitFailure",
        code: "revisionOverflow",
        retryable: false,
      },
      writeBlockReason: "revisionOverflow",
    },
    comments: [],
    error: null,
    reload: vi.fn(),
    createDraft: vi.fn(),
    updateDraftBody: vi.fn(),
    discardDraft: vi.fn(),
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    selectComment: vi.fn(),
    saveDraft: vi.fn(),
    updateComment: vi.fn(),
    ...overrides,
  };
}
