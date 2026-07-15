import { createCommentAnchorTestFixture } from "@/features/comments/testing/comment-anchor-test-fixture";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import {
  type CommentSelectionCommentActions,
  type UseCommentSelectionOptions,
  type UseCommentSelectionResult,
  useCommentSelection,
} from "@/app/App/hooks/useCommentSelection";
import { CommentListState } from "@/features/comments";
import { commentBody } from "@/features/comments/testing/comment-body-test-fixture";
import type { Comment, CommentAnchor } from "@/features/comments/types/comment";
import * as TestValues from "@/shared/testing/validatedValueObjects";

const commentId = TestValues.commentId;

const anchor: CommentAnchor = createCommentAnchorTestFixture({
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:a11ce001",
  textSnippet: "snippet",
  charRange: { start: 0, end: 7 },
});

function makeComment(id: string): Comment {
  return {
    id: commentId(id),
    anchor,
    body: `body-${id}`,
    status: "open",
    resolved: false,
    createdAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
    updatedAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
  };
}

const c1 = makeComment("cmt_1");
const c2 = makeComment("cmt_2");
const c3 = makeComment("cmt_3");
const comments = [c1, c2, c3];

const baseKeys: SpecViewResetKeys = {
  workspaceRoot: "/workspace",
  specId: TestValues.specId("spec-1"),
  fileKey: "impl",
};

function createActions(
  overrides: Partial<CommentSelectionCommentActions> = {},
): CommentSelectionCommentActions {
  return {
    addComment: vi.fn(async () => null),
    updateComment: vi.fn(async () => null),
    deleteComment: vi.fn(async () => true),
    resolveComment: vi.fn(async () => null),
    reopenComment: vi.fn(async () => null),
    ...overrides,
  };
}

type HookHandle = Readonly<{
  current: UseCommentSelectionResult;
  rerender: (options: UseCommentSelectionOptions) => void;
  unmount: () => void;
}>;

function renderHook(initialOptions: UseCommentSelectionOptions): HookHandle {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as unknown as UseCommentSelectionResult };

  function TestComponent(
    props: Readonly<{ options: UseCommentSelectionOptions }>,
  ): null {
    result.current = useCommentSelection(props.options);
    return null;
  }

  act(() => {
    root.render(<TestComponent options={initialOptions} />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (options: UseCommentSelectionOptions) => {
      act(() => {
        root.render(<TestComponent options={options} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function baseOptions(
  overrides: Partial<UseCommentSelectionOptions> = {},
): UseCommentSelectionOptions {
  return {
    comments,
    listState: CommentListState.loaded(comments),
    commentActions: createActions(),
    openSidebar: vi.fn(),
    resetKeys: baseKeys,
    ...overrides,
  };
}

test("初期状態ではactiveCommentIdがnullでanchor statesが空", () => {
  const hook = renderHook(baseOptions());

  expect(hook.current.activeCommentId).toBeNull();
  expect(hook.current.commentAnchorDisplayStates).toEqual([]);
  hook.unmount();
});

test("selectCommentでactiveが更新されopenSidebarが1回呼ばれる", () => {
  const openSidebar = vi.fn();
  const hook = renderHook(baseOptions({ openSidebar }));

  act(() => {
    hook.current.selectComment(c2.id);
  });

  expect(hook.current.activeCommentId).toBe(c2.id);
  expect(openSidebar).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test("addComment成功でtrueを返しactiveが追加コメントになる", async () => {
  const added = makeComment("cmt_new");
  const commentActions = createActions({
    addComment: vi.fn(async () => added),
  });
  const commentsWithAdded = [...comments, added];
  const hook = renderHook(
    baseOptions({
      commentActions,
      comments: commentsWithAdded,
      listState: CommentListState.loaded(commentsWithAdded),
    }),
  );

  let returned: boolean | undefined;
  await act(async () => {
    returned = await hook.current.addComment({
      anchor,
      body: commentBody("new"),
    });
  });

  expect(returned).toBe(true);
  expect(hook.current.activeCommentId).toBe(added.id);
  hook.unmount();
});

test("addComment失敗（null）でfalseを返しactiveは変化しない", async () => {
  const commentActions = createActions({ addComment: vi.fn(async () => null) });
  const hook = renderHook(baseOptions({ commentActions }));

  let returned: boolean | undefined;
  await act(async () => {
    returned = await hook.current.addComment({
      anchor,
      body: commentBody("new"),
    });
  });

  expect(returned).toBe(false);
  expect(hook.current.activeCommentId).toBeNull();
  hook.unmount();
});

test("アクティブなコメントをdeleteCommentすると選択解除される", () => {
  const deleteComment = vi.fn(async () => true);
  const hook = renderHook(
    baseOptions({ commentActions: createActions({ deleteComment }) }),
  );

  act(() => {
    hook.current.selectComment(c2.id);
  });
  act(() => {
    hook.current.deleteComment(c2.id);
  });

  expect(hook.current.activeCommentId).toBeNull();
  expect(deleteComment).toHaveBeenCalledWith(c2.id);
  hook.unmount();
});

test("アクティブなコメントをdeleteInlineCommentすると選択解除される", async () => {
  const deleteComment = vi.fn(async () => true);
  const hook = renderHook(
    baseOptions({ commentActions: createActions({ deleteComment }) }),
  );

  act(() => {
    hook.current.selectComment(c2.id);
  });
  let returned: boolean | undefined;
  await act(async () => {
    returned = await hook.current.deleteInlineComment(c2.id);
  });

  expect(returned).toBe(true);
  expect(hook.current.activeCommentId).toBeNull();
  hook.unmount();
});

test("非アクティブなコメントを削除してもactiveは維持される", () => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectComment(c2.id);
  });
  act(() => {
    hook.current.deleteComment(c1.id);
  });

  expect(hook.current.activeCommentId).toBe(c2.id);
  hook.unmount();
});

test.each([
  [
    "updateComment",
    (r: UseCommentSelectionResult) => r.updateComment(c1.id, commentBody("x")),
    "updateComment",
  ],
  [
    "resolveInlineComment",
    (r: UseCommentSelectionResult) => r.resolveInlineComment(c1.id),
    "resolveComment",
  ],
  [
    "reopenInlineComment",
    (r: UseCommentSelectionResult) => r.reopenInlineComment(c1.id),
    "reopenComment",
  ],
] as const)("%sは対応アクションへ委譲し非nullでtrueを返す", async (_label, invoke, actionKey) => {
  const commentActions = createActions({
    [actionKey]: vi.fn(async () => makeComment("cmt_1")),
  });
  const hook = renderHook(baseOptions({ commentActions }));

  let returned: boolean | undefined;
  await act(async () => {
    returned = await invoke(hook.current);
  });

  expect(returned).toBe(true);
  expect(commentActions[actionKey]).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test.each([
  [
    "updateComment",
    (r: UseCommentSelectionResult) => r.updateComment(c1.id, commentBody("x")),
    "updateComment",
  ],
  [
    "resolveInlineComment",
    (r: UseCommentSelectionResult) => r.resolveInlineComment(c1.id),
    "resolveComment",
  ],
  [
    "reopenInlineComment",
    (r: UseCommentSelectionResult) => r.reopenInlineComment(c1.id),
    "reopenComment",
  ],
] as const)("%sはnull結果でfalseを返す", async (_label, invoke, actionKey) => {
  const commentActions = createActions({
    [actionKey]: vi.fn(async () => null),
  });
  const hook = renderHook(baseOptions({ commentActions }));

  let returned: boolean | undefined;
  await act(async () => {
    returned = await invoke(hook.current);
  });

  expect(returned).toBe(false);
  hook.unmount();
});

test.each([
  ["fileKey", { ...baseKeys, fileKey: "tasks" as const }],
  ["specId", { ...baseKeys, specId: TestValues.specId("spec-2") }],
  ["workspaceRoot", { ...baseKeys, workspaceRoot: "/other" }],
])("%s変更で選択がリセットされる", (_label, nextKeys) => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectComment(c2.id);
    hook.current.updateCommentAnchorDisplayStates([]);
  });

  hook.rerender(baseOptions({ resetKeys: nextKeys }));

  expect(hook.current.activeCommentId).toBeNull();
  expect(hook.current.commentAnchorDisplayStates).toEqual([]);
  hook.unmount();
});

test("loaded状態でactiveがリストから消えるとpruningされる", () => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectComment(c3.id);
  });

  hook.rerender(
    baseOptions({
      comments: [c1, c2],
      listState: CommentListState.loaded([c1, c2]),
    }),
  );

  expect(hook.current.activeCommentId).toBeNull();
  hook.unmount();
});

test("未ロード時はpruningされずactiveが維持される", () => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectComment(c3.id);
  });

  hook.rerender(
    baseOptions({ comments: [], listState: CommentListState.loading() }),
  );

  expect(hook.current.activeCommentId).toBe(c3.id);
  hook.unmount();
});

test("隣接コメントnext/previousで隣のidがアクティブになる", () => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectComment(c2.id);
  });
  let next: boolean | undefined;
  act(() => {
    next = hook.current.selectAdjacentComment("next");
  });
  expect(next).toBe(true);
  expect(hook.current.activeCommentId).toBe(c3.id);

  act(() => {
    hook.current.selectAdjacentComment("previous");
  });
  expect(hook.current.activeCommentId).toBe(c2.id);
  hook.unmount();
});

test("末尾でnextすると先頭へ循環する", () => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectComment(c3.id);
  });
  act(() => {
    hook.current.selectAdjacentComment("next");
  });

  expect(hook.current.activeCommentId).toBe(c1.id);
  hook.unmount();
});

test.each([
  ["next", "cmt_1"],
  ["previous", "cmt_3"],
] as const)("active未選択時の隣接ナビはフォールバック開始位置(%s)へ移動する", (direction, expectedId) => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.selectAdjacentComment(direction);
  });

  expect(hook.current.activeCommentId).toBe(commentId(expectedId));
  hook.unmount();
});

test("コメント0件では隣接ナビがfalseを返し状態不変", () => {
  const hook = renderHook(
    baseOptions({ comments: [], listState: CommentListState.loaded([]) }),
  );

  let returned: boolean | undefined;
  act(() => {
    returned = hook.current.selectAdjacentComment("next");
  });

  expect(returned).toBe(false);
  expect(hook.current.activeCommentId).toBeNull();
  hook.unmount();
});

test("updateCommentAnchorDisplayStatesで状態が置き換わる", () => {
  const hook = renderHook(baseOptions());
  const nextStates = [{ commentId: c1.id, status: "exact" as const }];

  act(() => {
    hook.current.updateCommentAnchorDisplayStates(nextStates);
  });

  expect(hook.current.commentAnchorDisplayStates).toEqual(nextStates);
  hook.unmount();
});

test("clearActiveCommentはactiveのみnullにしanchor statesは変更しない", () => {
  const hook = renderHook(baseOptions());
  const nextStates = [{ commentId: c1.id, status: "exact" as const }];

  act(() => {
    hook.current.selectComment(c2.id);
    hook.current.updateCommentAnchorDisplayStates(nextStates);
  });
  act(() => {
    hook.current.clearActiveComment();
  });

  expect(hook.current.activeCommentId).toBeNull();
  expect(hook.current.commentAnchorDisplayStates).toEqual(nextStates);
  hook.unmount();
});
