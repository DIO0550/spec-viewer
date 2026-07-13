import * as TestValues from "@/shared/testing/validatedValueObjects";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { SpecViewResetKeys } from "@/app/App/hooks/types";
import {
  type CommentExportCommands,
  type UseCommentExportOptions,
  type UseCommentExportResult,
  useCommentExport,
} from "@/app/App/hooks/useCommentExport";
import type {
  Comment,
  CommentAnchor,
  CommentExportScope,
  ExportCommentsResponse,
  GenerateLlmPromptResponse,
} from "@/features/comments/types/comment";
import { toCommentFeatureError } from "@/features/comments";
import { getUnknownErrorMessage } from "@/shared/lib/errorMessage";

const commentId = TestValues.commentId;

const anchor: CommentAnchor = {
  fileKey: "impl",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:anchor",
  textSnippet: "snippet",
  charRange: { start: 0, end: 7 },
};

const openComment: Comment = {
  id: commentId("cmt_1"),
  anchor,
  body: "body",
  status: "open",
  resolved: false,
  createdAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
  updatedAt: TestValues.isoDateTime("2026-05-05T10:00:00Z"),
};

const baseKeys: SpecViewResetKeys = {
  workspaceRoot: "/workspace",
  specId: TestValues.specId("spec-1"),
  fileKey: "impl",
};

const exportResponse: ExportCommentsResponse = {
  destinationPath: "/out.md",
  format: "markdown",
  commentCount: 3,
};

const llmResponse: GenerateLlmPromptResponse = {
  prompt: "PROMPT",
  commentCount: 3,
  contextFileCount: 2,
};

function createCommands(
  overrides: Partial<CommentExportCommands> = {},
): CommentExportCommands {
  return {
    exportComments: vi.fn(async () => exportResponse),
    generateLlmPrompt: vi.fn(async () => llmResponse),
    selectCommentExportDestination: vi.fn(async () => "/out.md"),
    ...overrides,
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

type HookHandle = Readonly<{
  current: UseCommentExportResult;
  rerender: (options: UseCommentExportOptions) => void;
  unmount: () => void;
}>;

function renderHook(initialOptions: UseCommentExportOptions): HookHandle {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as unknown as UseCommentExportResult };

  function TestComponent(
    props: Readonly<{ options: UseCommentExportOptions }>,
  ): null {
    result.current = useCommentExport(props.options);
    return null;
  }

  act(() => {
    root.render(<TestComponent options={initialOptions} />);
  });

  return {
    get current() {
      return result.current;
    },
    rerender: (options: UseCommentExportOptions) => {
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
  overrides: Partial<UseCommentExportOptions> = {},
): UseCommentExportOptions {
  return {
    resetKeys: baseKeys,
    comments: [openComment],
    commands: createCommands(),
    copyText: vi.fn(async () => {}),
    ...overrides,
  };
}

test("初期状態はidle", () => {
  const hook = renderHook(baseOptions());

  expect(hook.current.commentExportState).toEqual({
    status: "idle",
    operation: null,
    message: null,
  });
  hook.unmount();
});

test("export成功で保存先選択中→export中→successへ遷移する", async () => {
  const destination = deferred<string | null>();
  const commands = createCommands({
    selectCommentExportDestination: vi.fn(() => destination.promise),
  });
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.exportCommentScope("workspace");
  });

  expect(hook.current.commentExportState).toEqual({
    status: "saving",
    operation: "workspace",
    message: "export先を選択中",
  });

  destination.resolve("/out.md");
  await flush();

  expect(hook.current.commentExportState).toEqual({
    status: "success",
    operation: "workspace",
    message: "3件のコメントを/out.mdへexportしました。",
  });
  expect(commands.exportComments).toHaveBeenCalledWith({
    workspacePath: "/workspace",
    target: { scope: "workspace" },
    destinationPath: "/out.md",
  });
  hook.unmount();
});

test("export先選択キャンセルでidleへ戻りexportComponentsは呼ばれない", async () => {
  const commands = createCommands({
    selectCommentExportDestination: vi.fn(async () => null),
  });
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.exportCommentScope("workspace");
  });
  await flush();

  expect(hook.current.commentExportState.status).toBe("idle");
  expect(commands.exportComments).not.toHaveBeenCalled();
  hook.unmount();
});

test("export失敗でerror状態とExportCommentsCommandErrorのメッセージになる", async () => {
  const failure = new Error("export boom");
  const commands = createCommands({
    exportComments: vi.fn(async () => {
      throw failure;
    }),
  });
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.exportCommentScope("workspace");
  });
  await flush();

  expect(hook.current.commentExportState).toEqual({
    status: "error",
    operation: "workspace",
    message: toCommentFeatureError("export", failure).message,
  });
  hook.unmount();
});

test.each([
  ["workspace", { scope: "workspace" }],
  ["spec", { scope: "spec", specId: TestValues.specId("spec-1") }],
  [
    "file",
    { scope: "file", specId: TestValues.specId("spec-1"), fileKey: "impl" },
  ],
] as const)("scope別（%s）にtargetが組み立てられる", async (scope, expectedTarget) => {
  const commands = createCommands();
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.exportCommentScope(scope as CommentExportScope);
  });
  await flush();

  expect(commands.selectCommentExportDestination).toHaveBeenCalledWith(
    expectedTarget,
  );
  hook.unmount();
});

test("LLM promptコピー成功でcopyTextにpromptが渡りsuccessになる", async () => {
  const copyText = vi.fn(async () => {});
  const hook = renderHook(baseOptions({ copyText }));

  act(() => {
    hook.current.copyLlmPromptScope("workspace");
  });
  await flush();

  expect(copyText).toHaveBeenCalledWith("PROMPT");
  expect(hook.current.commentExportState).toEqual({
    status: "success",
    operation: "workspace",
    message: "2ファイル / 3件のコメントを含むLLM promptをコピーしました。",
  });
  hook.unmount();
});

test("LLM prompt生成失敗でerror状態とGenerateLlmPromptCommandErrorのメッセージになる", async () => {
  const failure = new Error("llm boom");
  const commands = createCommands({
    generateLlmPrompt: vi.fn(async () => {
      throw failure;
    }),
  });
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.copyLlmPromptScope("workspace");
  });
  await flush();

  expect(hook.current.commentExportState).toEqual({
    status: "error",
    operation: "workspace",
    message: toCommentFeatureError("generatePrompt", failure).message,
  });
  hook.unmount();
});

test("MCP feedbackコピー成功でcopyTextが呼ばれsuccessになる", async () => {
  const copyText = vi.fn(async () => {});
  const hook = renderHook(baseOptions({ copyText }));

  await act(async () => {
    await hook.current.copyMcpFeedbackPayload();
  });

  expect(copyText).toHaveBeenCalledTimes(1);
  expect(hook.current.commentExportState.status).toBe("success");
  expect(hook.current.commentExportState.operation).toBe("mcpFeedback");
  hook.unmount();
});

test("MCP feedbackのcopyText失敗でerror状態とgetUnknownErrorMessageのメッセージになる", async () => {
  const failure = new Error("copy boom");
  const copyText = vi.fn(async () => {
    throw failure;
  });
  const hook = renderHook(baseOptions({ copyText }));

  await act(async () => {
    await hook.current.copyMcpFeedbackPayload();
  });

  expect(hook.current.commentExportState).toEqual({
    status: "error",
    operation: "mcpFeedback",
    message: getUnknownErrorMessage(failure),
  });
  hook.unmount();
});

test.each([
  [
    "export",
    (r: UseCommentExportResult): void => r.exportCommentScope("workspace"),
  ],
  [
    "llm",
    (r: UseCommentExportResult): void => r.copyLlmPromptScope("workspace"),
  ],
  [
    "mcp",
    (r: UseCommentExportResult): void => {
      void r.copyMcpFeedbackPayload();
    },
  ],
] as const)("workspace未選択（%s）では状態遷移せずコマンド未呼び出し", async (_label, invoke) => {
  const commands = createCommands();
  const copyText = vi.fn(async () => {});
  const hook = renderHook(
    baseOptions({
      resetKeys: { ...baseKeys, workspaceRoot: null },
      commands,
      copyText,
    }),
  );

  act(() => {
    invoke(hook.current);
  });
  await flush();

  expect(hook.current.commentExportState.status).toBe("idle");
  expect(commands.selectCommentExportDestination).not.toHaveBeenCalled();
  expect(commands.generateLlmPrompt).not.toHaveBeenCalled();
  expect(copyText).not.toHaveBeenCalled();
  hook.unmount();
});

test("spec未選択では全scopeがno-op", async () => {
  const commands = createCommands();
  const hook = renderHook(
    baseOptions({ resetKeys: { ...baseKeys, specId: null }, commands }),
  );

  act(() => {
    hook.current.exportCommentScope("workspace");
    hook.current.exportCommentScope("spec");
    hook.current.exportCommentScope("file");
  });
  await flush();

  expect(commands.selectCommentExportDestination).not.toHaveBeenCalled();
  hook.unmount();
});

test("file scopeでfileKey未選択ならno-op", async () => {
  const commands = createCommands();
  const hook = renderHook(
    baseOptions({ resetKeys: { ...baseKeys, fileKey: null }, commands }),
  );

  act(() => {
    hook.current.exportCommentScope("file");
  });
  await flush();

  expect(commands.selectCommentExportDestination).not.toHaveBeenCalled();
  hook.unmount();
});

test("選択変更でsuccess表示中の状態がidleへリセットされる", async () => {
  const hook = renderHook(baseOptions());

  act(() => {
    hook.current.exportCommentScope("workspace");
  });
  await flush();
  expect(hook.current.commentExportState.status).toBe("success");

  hook.rerender(
    baseOptions({
      resetKeys: { ...baseKeys, specId: TestValues.specId("spec-2") },
    }),
  );

  expect(hook.current.commentExportState.status).toBe("idle");
  hook.unmount();
});

test("saving中の再トリガーは後勝ちでstateが置き換わる", async () => {
  const destination = deferred<string | null>();
  const commands = createCommands({
    selectCommentExportDestination: vi.fn(() => destination.promise),
  });
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.exportCommentScope("workspace");
  });
  expect(hook.current.commentExportState.message).toBe("export先を選択中");

  act(() => {
    hook.current.copyLlmPromptScope("workspace");
  });

  expect(hook.current.commentExportState).toEqual({
    status: "saving",
    operation: "workspace",
    message: "LLM promptを生成中",
  });

  destination.resolve(null);
  await flush();
  hook.unmount();
});

test("選択変更リセット後にin-flightが遅延完了するとidleを上書きする", async () => {
  const destination = deferred<string | null>();
  const commands = createCommands({
    selectCommentExportDestination: vi.fn(() => destination.promise),
  });
  const hook = renderHook(baseOptions({ commands }));

  act(() => {
    hook.current.exportCommentScope("workspace");
  });
  expect(hook.current.commentExportState.status).toBe("saving");

  hook.rerender(
    baseOptions({
      resetKeys: { ...baseKeys, specId: TestValues.specId("spec-2") },
      commands,
    }),
  );
  expect(hook.current.commentExportState.status).toBe("idle");

  destination.resolve("/out.md");
  await flush();

  expect(hook.current.commentExportState.status).toBe("success");
  hook.unmount();
});
