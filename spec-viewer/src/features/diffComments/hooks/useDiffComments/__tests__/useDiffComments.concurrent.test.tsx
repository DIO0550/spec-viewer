import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import {
  type UseDiffCommentsOptions,
  useDiffComments,
} from "@/features/diffComments";
import type {
  DiffCommentCommands,
  LoadDiffCommentsRequest,
  SaveDiffCommentRequest,
} from "@/lib/api/tauri";

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const identityA = {
  repositoryId: `rr1_${"a".repeat(64)}`,
  worktreeId: `rw1_${"b".repeat(64)}`,
  baseSha: "c".repeat(40),
  currentSnapshotId: `rs1_${"d".repeat(64)}`,
} as const;
const identityB = {
  ...identityA,
  worktreeId: `rw1_${"e".repeat(64)}`,
} as const;
const refreshedIdentityA = {
  ...identityA,
  currentSnapshotId: `rs1_${"f".repeat(64)}`,
} as const;

function createDocument(identity: typeof identityA, revision: string) {
  return {
    version: 1 as const,
    repositoryId: identity.repositoryId,
    worktreeId: identity.worktreeId,
    revision,
    comments: [],
    resolutionWarnings: [],
  };
}

function deferred<Value>(): {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
} {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
  };
}

function renderHook(options: UseDiffCommentsOptions) {
  const container = document.createElement("div");
  const root = createRoot(container);
  const current = {
    value: undefined as unknown as ReturnType<typeof useDiffComments>,
  };
  function TestComponent(props: Readonly<{ options: UseDiffCommentsOptions }>) {
    current.value = useDiffComments(props.options);
    return null;
  }
  act(() => root.render(<TestComponent options={options} />));
  return {
    current: () => current.value,
    rerender: (next: UseDiffCommentsOptions) =>
      act(() => root.render(<TestComponent options={next} />)),
    unmount: () => act(() => root.unmount()),
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

test("[R199-ERR-003] 古いidentityのload responseは現在のsessionを上書きしない", async () => {
  const loadA = deferred<ReturnType<typeof createDocument>>();
  const commands: DiffCommentCommands = {
    load: vi.fn((request: LoadDiffCommentsRequest) => {
      if (request.identity.worktreeId === identityA.worktreeId) {
        return loadA.promise;
      }
      return Promise.resolve(createDocument(identityB, "2"));
    }),
    save: vi.fn(),
    update: vi.fn(),
  };
  const hook = renderHook({ identity: identityA, commands });
  hook.rerender({ identity: identityB, commands });
  await flush();

  loadA.resolve(createDocument(identityA, "1"));
  await flush();

  expect(hook.current().session?.identity).toEqual(identityB);
  expect(hook.current().session?.revision).toBe("2");
  hook.unmount();
});

test("4値が同じidentity objectへのrerenderでは再loadしない", async () => {
  const commands: DiffCommentCommands = {
    load: vi.fn((request) =>
      Promise.resolve(createDocument(request.identity, "0")),
    ),
    save: vi.fn(),
    update: vi.fn(),
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  hook.rerender({ identity: { ...identityA }, commands });
  await flush();

  expect(commands.load).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test("mutation responseは表示中ではなくorigin sessionへsettleする", async () => {
  const save = deferred<Awaited<ReturnType<DiffCommentCommands["save"]>>>();
  const commands: DiffCommentCommands = {
    load: vi.fn((request) =>
      Promise.resolve(createDocument(request.identity, "0")),
    ),
    save: vi.fn((_request: SaveDiffCommentRequest) => save.promise),
    update: vi.fn(),
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();
  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      body: "review",
    });
  });
  let savePromise: Promise<boolean> | undefined;
  act(() => {
    savePromise = hook.current().saveDraft();
  });
  hook.rerender({ identity: identityB, commands });
  await flush();

  const committedDocument = createDocument(identityA, "1");
  save.resolve({
    kind: "committed",
    document: committedDocument,
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  });
  await act(async () => savePromise);

  hook.rerender({ identity: identityA, commands });
  expect(hook.current().session?.revision).toBe("1");
  expect(hook.current().session?.draft).toBeNull();
  hook.unmount();
});

test("identity Aのerrorはidentity Bへ漏れない", async () => {
  const commands: DiffCommentCommands = {
    load: vi.fn((request) =>
      request.identity.worktreeId === identityA.worktreeId
        ? Promise.reject({
            command: "load_diff_comments",
            code: "unavailable",
            message: "A unavailable",
            raw: null,
          })
        : Promise.resolve(createDocument(identityB, "2")),
    ),
    save: vi.fn(),
    update: vi.fn(),
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();
  expect(hook.current().error?.message).toBe("A unavailable");

  hook.rerender({ identity: identityB, commands });
  await flush();

  expect(hook.current().session?.identity).toEqual(identityB);
  expect(hook.current().error).toBeNull();
  hook.unmount();
});

test("同じidentityのmutationはin-flight中に二重送信しない", async () => {
  const update = deferred<Awaited<ReturnType<DiffCommentCommands["update"]>>>();
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save: vi.fn(),
    update: vi.fn(() => update.promise),
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  let first: Promise<boolean> | undefined;
  let second: Promise<boolean> | undefined;
  act(() => {
    first = hook.current().updateComment({
      commentId: "cmt_1",
      resolved: true,
    });
    second = hook.current().updateComment({
      commentId: "cmt_1",
      resolved: false,
    });
  });

  await expect(second).resolves.toBe(false);
  expect(commands.update).toHaveBeenCalledTimes(1);
  update.resolve({
    kind: "committed",
    document: createDocument(identityA, "1"),
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  });
  await act(async () => first);

  expect(hook.current().session?.revision).toBe("1");
  hook.unmount();
});

test("injected commandの異なるdocument scopeを拒否する", async () => {
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityB, "0"))),
    save: vi.fn(),
    update: vi.fn(),
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  expect(hook.current().session?.loadState).toBe("error");
  expect(hook.current().error).toMatchObject({
    command: "load_diff_comments",
    code: "invalidResponse",
  });
  hook.unmount();
});

test("非retryable write blockは全mutationを拒否し成功reloadだけが解除する", async () => {
  const update = vi
    .fn<DiffCommentCommands["update"]>()
    .mockResolvedValueOnce({
      kind: "preCommitFailure",
      code: "invalidStore",
      retryable: false,
    })
    .mockResolvedValueOnce({
      kind: "committed",
      document: createDocument(identityA, "1"),
      revision: "1",
      resolutionWarnings: [],
      durability: "durable",
    });
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save: vi.fn(),
    update,
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  await act(async () => {
    await hook.current().updateComment({
      commentId: "cmt_1",
      resolved: true,
    });
  });
  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      body: "cannot bypass",
    });
    hook.current().reanchorDraft({
      side: "current",
      newPath: "src/next.ts",
      line: 2,
    });
  });

  await expect(
    hook.current().updateComment({ commentId: "cmt_1", resolved: false }),
  ).resolves.toBe(false);
  await expect(hook.current().saveDraft()).resolves.toBe(false);
  expect(update).toHaveBeenCalledTimes(1);
  expect(hook.current().session?.draft).toMatchObject({
    canSubmit: false,
    disabledReason: "invalidStore",
  });

  await act(async () => {
    await hook.current().reload();
  });
  await act(async () => {
    await hook.current().updateComment({
      commentId: "cmt_1",
      resolved: false,
    });
  });
  expect(update).toHaveBeenCalledTimes(2);
  hook.unmount();
});

test("conflictのlatest revisionがu64上限ならdraft再送をcommand境界で拒否する", async () => {
  const maximumRevision = "18446744073709551615";
  const save = vi.fn<DiffCommentCommands["save"]>().mockResolvedValue({
    kind: "conflict",
    latestDocument: createDocument(identityA, maximumRevision),
    latestRevision: maximumRevision,
    resolutionWarnings: [],
  });
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save,
    update: vi.fn(),
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();
  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      body: "copy after overflow conflict",
    });
  });

  await act(async () => {
    await hook.current().saveDraft();
  });

  expect(hook.current().session?.writeBlockReason).toBe("revisionOverflow");
  expect(hook.current().session?.draft).toMatchObject({
    canSubmit: false,
    disabledReason: "revisionOverflow",
  });
  await expect(hook.current().saveDraft()).resolves.toBe(false);
  expect(save).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test("draftの新規保存と本文更新はtrim済みbodyをwireへ送る", async () => {
  const save = vi.fn<DiffCommentCommands["save"]>().mockResolvedValue({
    kind: "committed",
    document: createDocument(identityA, "1"),
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  });
  const update = vi.fn<DiffCommentCommands["update"]>().mockResolvedValue({
    kind: "committed",
    document: createDocument(identityA, "2"),
    revision: "2",
    resolutionWarnings: [],
    durability: "durable",
  });
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save,
    update,
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      body: "  create body  ",
    });
  });
  await act(async () => {
    await hook.current().saveDraft();
  });
  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      commentId: "comment-1",
      body: "  edit body  ",
    });
  });
  await act(async () => {
    await hook.current().saveDraft();
  });

  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ body: "create body" }),
  );
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ body: "edit body" }),
  );
  hook.unmount();
});

test("Review cardの本文更新はtrim済みbodyをwireへ送る", async () => {
  const update = vi.fn<DiffCommentCommands["update"]>().mockResolvedValue({
    kind: "committed",
    document: createDocument(identityA, "1"),
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  });
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save: vi.fn(),
    update,
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  await act(async () => {
    await hook.current().updateComment({
      commentId: "comment-1",
      body: "  card body  ",
    });
  });

  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ body: "card body" }),
  );
  hook.unmount();
});

test("保存時のstaleSnapshot更新後はdraftを同じtargetで再試行できる", async () => {
  const onIdentityInvalidated = vi.fn();
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save: vi.fn(() =>
      Promise.reject({
        command: "save_diff_comment",
        code: "staleSnapshot",
        message: "stale snapshot",
        raw: null,
      }),
    ),
    update: vi.fn(),
  };
  const hook = renderHook({
    identity: identityA,
    commands,
    onIdentityInvalidated,
  });
  await flush();
  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      body: "keep this comment",
    });
  });

  await act(async () => {
    await hook.current().saveDraft();
  });

  expect(onIdentityInvalidated).toHaveBeenCalledTimes(1);
  expect(hook.current().session?.draft?.body).toBe("keep this comment");
  expect(hook.current().error?.code).toBe("staleSnapshot");

  hook.rerender({
    identity: refreshedIdentityA,
    commands,
    onIdentityInvalidated,
  });
  await flush();

  expect(hook.current().session?.draft).toMatchObject({
    state: "active",
    body: "keep this comment",
    canSubmit: true,
    disabledReason: null,
  });
  hook.unmount();
});

test("保存時のstaleSnapshot更新後は最新identityでdraftを自動再送する", async () => {
  const onIdentityInvalidated = vi.fn();
  const save = vi
    .fn<DiffCommentCommands["save"]>()
    .mockRejectedValueOnce({
      command: "save_diff_comment",
      code: "staleSnapshot",
      message: "stale snapshot",
      raw: null,
    })
    .mockResolvedValueOnce({
      kind: "committed",
      document: createDocument(refreshedIdentityA, "1"),
      revision: "1",
      resolutionWarnings: [],
      durability: "durable",
    });
  const commands: DiffCommentCommands = {
    load: vi.fn((request) =>
      Promise.resolve(createDocument(request.identity, "0")),
    ),
    save,
    update: vi.fn(),
  };
  const hook = renderHook({
    identity: identityA,
    commands,
    onIdentityInvalidated,
  });
  await flush();
  act(() => {
    hook.current().createDraft({
      target: { side: "current", newPath: "src/main.ts", line: 1 },
      body: "save after refresh",
    });
  });

  await act(async () => {
    await hook.current().saveDraft();
  });
  hook.rerender({
    identity: refreshedIdentityA,
    commands,
    onIdentityInvalidated,
  });
  await flush();
  await flush();

  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      identity: refreshedIdentityA,
      expectedRevision: "0",
      body: "save after refresh",
    }),
  );
  expect(hook.current().session?.draft).toBeNull();
  expect(hook.current().session?.revision).toBe("1");
  hook.unmount();
});
test("返信本文をtrimして現在revisionと共にwireへ送る", async () => {
  const update = vi.fn<DiffCommentCommands["update"]>().mockResolvedValue({
    kind: "committed",
    document: createDocument(identityA, "1"),
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  });
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save: vi.fn(),
    update,
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  await act(async () => {
    await hook.current().updateComment({
      commentId: "comment-1",
      replyBody: "  follow up  ",
    });
  });

  expect(update).toHaveBeenCalledWith({
    identity: identityA,
    expectedRevision: "0",
    commentId: "comment-1",
    replyBody: "follow up",
  });
  hook.unmount();
});

test("コメント削除はdeletedフラグと現在revisionをwireへ送る", async () => {
  const update = vi.fn<DiffCommentCommands["update"]>().mockResolvedValue({
    kind: "committed",
    document: createDocument(identityA, "1"),
    revision: "1",
    resolutionWarnings: [],
    durability: "durable",
  });
  const commands: DiffCommentCommands = {
    load: vi.fn(() => Promise.resolve(createDocument(identityA, "0"))),
    save: vi.fn(),
    update,
  };
  const hook = renderHook({ identity: identityA, commands });
  await flush();

  await act(async () => {
    await hook.current().updateComment({
      commentId: "comment-1",
      deleted: true,
    });
  });

  expect(update).toHaveBeenCalledWith({
    identity: identityA,
    expectedRevision: "0",
    commentId: "comment-1",
    deleted: true,
  });
  hook.unmount();
});
