import { expect, test, vi } from "vitest";

import { CommentId } from "@/features/comments/types/comment";
import type { UserReviewRepository } from "@/features/review-runs/application/ports/userReviewRepository";
import {
  OperationToken,
  SelectionIdentity,
  type UserReviewApplicationEvent,
  UserReviewApplicationState,
} from "@/features/review-runs/application/userReviewApplication";
import {
  createUserReviewApplicationService,
  type UserReviewApplicationDispatch,
  type UserReviewApplicationService,
} from "@/features/review-runs/application/userReviewApplicationService";
import { createUserReviewUseCases } from "@/features/review-runs/application/userReviewUseCases";
import type {
  ActiveUserReview,
  ArchivedUserReview,
} from "@/features/review-runs/domain/userReview";
import type { UserReviewListOutcome } from "@/features/review-runs/domain/userReviewListOutcome";
import { UserReviewListState } from "@/features/review-runs/domain/userReviewListState";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const target = {
  scope: "file",
  specId: "auth-flow",
  fileKey: "tasks",
} as const;
const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");
const commentId = CommentId.fromString("cmt_one");
const selectionIdentity = SelectionIdentity.create({
  key: "selection-auth-tasks",
  workspacePath,
  target,
});
const otherSelectionIdentity = SelectionIdentity.create({
  key: "selection-billing-tasks",
  workspacePath,
  target: { ...target, specId: "billing" },
});
const activeReview = createActiveUserReview("urv_active");
const archivedReview: ArchivedUserReview = {
  ...activeReview,
  status: "archived",
  updatedAt: "2026-07-13T10:30:00Z",
  archivedAt: "2026-07-13T10:30:00Z",
};

test("create成功はloading中のlistを無効化し古いlist完了で上書きされない", () => {
  const listToken = OperationToken.create("list", selectionIdentity, 1);
  const createToken = OperationToken.create("create", selectionIdentity, 2);
  let state = UserReviewApplicationState.initial(selectionIdentity);

  state = UserReviewApplicationState.reduce(state, {
    type: "listStarted",
    token: listToken,
    target,
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "createStarted",
    token: createToken,
    payload: { commentIds: [commentId] },
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "createSucceeded",
    token: createToken,
    payload: { commentIds: [commentId] },
    userReview: activeReview,
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "listSucceeded",
    token: listToken,
    target,
    collection: { active: [], archived: [], problems: [] },
  });

  expect(state.listState.active).toEqual([activeReview]);
  expect(state.createState).toMatchObject({
    status: "success",
    result: activeReview,
  });
  expect(state.listToken).toBeNull();
});

test("archive成功はactiveからarchivedへ移し同時実行listを無効化する", () => {
  const listToken = OperationToken.create("list", selectionIdentity, 1);
  const archiveToken = OperationToken.create("archive", selectionIdentity, 2);
  let state = UserReviewApplicationState.initial(selectionIdentity);
  state = {
    ...state,
    listState: UserReviewListState.loaded(target, {
      active: [activeReview],
      archived: [],
      problems: [],
    }),
  };

  state = UserReviewApplicationState.reduce(state, {
    type: "listStarted",
    token: listToken,
    target,
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "archiveStarted",
    token: archiveToken,
    payload: { userReviewId: activeReview.id },
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "archiveSucceeded",
    token: archiveToken,
    payload: { userReviewId: activeReview.id },
    userReview: archivedReview,
  });

  expect(state.listState.active).toEqual([]);
  expect(state.listState.archived).toEqual([archivedReview]);
  expect(state.listToken).toBeNull();
});

test("selection変更後の古いoperation結果は全stateから破棄する", () => {
  const createToken = OperationToken.create("create", selectionIdentity, 1);
  let state = UserReviewApplicationState.initial(selectionIdentity);
  state = UserReviewApplicationState.reduce(state, {
    type: "createStarted",
    token: createToken,
    payload: { commentIds: [commentId] },
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "selectionChanged",
    selectionIdentity: otherSelectionIdentity,
  });
  state = UserReviewApplicationState.reduce(state, {
    type: "createSucceeded",
    token: createToken,
    payload: { commentIds: [commentId] },
    userReview: activeReview,
  });

  expect(state.selectionIdentity).toBe(otherSelectionIdentity);
  expect(state.listState.status).toBe("idle");
  expect(state.createState.status).toBe("idle");
});

test("SelectionIdentity.equalsはworkspaceなしでもtarget差分を同一視しない", () => {
  const first = SelectionIdentity.create({
    key: "same-upstream-key",
    workspacePath: null,
    target,
  });
  const second = SelectionIdentity.create({
    key: "same-upstream-key",
    workspacePath: null,
    target: { ...target, specId: "billing" },
  });

  expect(SelectionIdentity.equals(first, second)).toBe(false);
});

test("OperationToken.equalsは同じ構造を持つ別operation tokenを区別する", () => {
  const first = OperationToken.create("list", selectionIdentity, 1);
  const second = OperationToken.create("list", selectionIdentity, 1);

  expect(OperationToken.equals(first, first)).toBe(true);
  expect(OperationToken.equals(first, second)).toBe(false);
});

test.each([
  {
    operation: "list",
    expected: false,
    invoke: (
      service: UserReviewApplicationService,
      dispatch: UserReviewApplicationDispatch,
    ) =>
      service.list(
        { selectionIdentity, workspacePath, target, correlationId: null },
        dispatch,
      ),
  },
  {
    operation: "create",
    expected: null,
    invoke: (
      service: UserReviewApplicationService,
      dispatch: UserReviewApplicationDispatch,
    ) =>
      service.create(
        { selectionIdentity, workspacePath, target, commentIds: [commentId] },
        dispatch,
      ),
  },
  {
    operation: "archive",
    expected: null,
    invoke: (
      service: UserReviewApplicationService,
      dispatch: UserReviewApplicationDispatch,
    ) =>
      service.archive(
        { selectionIdentity, workspacePath, target, userReview: activeReview },
        dispatch,
      ),
  },
])("application serviceはdispose後の$operationをrepository前に破棄する", async ({
  invoke,
  expected,
}) => {
  const repository = createRepository();
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();
  service.dispose();

  await expect(invoke(service, dispatch)).resolves.toBe(expected);

  expect(repository.list).not.toHaveBeenCalled();
  expect(repository.create).not.toHaveBeenCalled();
  expect(repository.archive).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

test("application serviceはdispose後にselectされると操作を再開できる", async () => {
  const repository: UserReviewRepository = {
    list: vi.fn().mockResolvedValue({
      ok: true,
      value: { active: [], archived: [], problems: [] },
    }),
    create: vi.fn(),
    archive: vi.fn(),
  };
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();
  service.dispose();

  service.select(selectionIdentity, dispatch);
  await expect(
    service.list(
      { selectionIdentity, workspacePath, target, correlationId: null },
      dispatch,
    ),
  ).resolves.toBe(true);

  expect(repository.list).toHaveBeenCalledTimes(1);
});

test("application serviceはselection変更後の古いlist inputを開始前に破棄する", async () => {
  const repository = createRepository();
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  service.select(otherSelectionIdentity, vi.fn());
  const dispatch = vi.fn();

  await expect(
    service.list(
      { selectionIdentity, workspacePath, target, correlationId: null },
      dispatch,
    ),
  ).resolves.toBe(false);

  expect(repository.list).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

test("application serviceはselection変更後の古いcreate inputを開始前に破棄する", async () => {
  const repository = createRepository();
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  service.select(otherSelectionIdentity, vi.fn());
  const dispatch = vi.fn();

  await expect(
    service.create(
      { selectionIdentity, workspacePath, target, commentIds: [commentId] },
      dispatch,
    ),
  ).resolves.toBeNull();

  expect(repository.create).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

test("application serviceはselection変更後の古いarchive inputを開始前に破棄する", async () => {
  const repository = createRepository();
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  service.select(otherSelectionIdentity, vi.fn());
  const dispatch = vi.fn();

  await expect(
    service.archive(
      { selectionIdentity, workspacePath, target, userReview: activeReview },
      dispatch,
    ),
  ).resolves.toBeNull();

  expect(repository.archive).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

test("application serviceはidentityと異なるcontextのmutation inputを破棄する", async () => {
  const repository = createRepository();
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();
  const otherWorkspacePath = WorkspacePath.fromString("/workspace/other");
  const otherTarget = { ...target, specId: "billing" };

  await expect(
    service.create(
      {
        selectionIdentity,
        workspacePath: otherWorkspacePath,
        target,
        commentIds: [commentId],
      },
      dispatch,
    ),
  ).resolves.toBeNull();
  await expect(
    service.archive(
      {
        selectionIdentity,
        workspacePath,
        target: otherTarget,
        userReview: activeReview,
      },
      dispatch,
    ),
  ).resolves.toBeNull();

  expect(repository.create).not.toHaveBeenCalled();
  expect(repository.archive).not.toHaveBeenCalled();
  expect(dispatch).not.toHaveBeenCalled();
});

test("application serviceはAからBを経てAへ戻った後に古いlist結果を破棄する", async () => {
  const staleDeferred = createDeferred<UserReviewListOutcome>();
  const currentDeferred = createDeferred<UserReviewListOutcome>();
  const list = vi
    .fn()
    .mockReturnValueOnce(staleDeferred.promise)
    .mockReturnValueOnce(currentDeferred.promise);
  const repository: UserReviewRepository = {
    list,
    create: vi.fn(),
    archive: vi.fn(),
  };
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();

  const stalePromise = service.list(
    { selectionIdentity, workspacePath, target, correlationId: null },
    dispatch,
  );
  service.select(otherSelectionIdentity, dispatch);
  service.select(selectionIdentity, dispatch);
  const currentPromise = service.list(
    { selectionIdentity, workspacePath, target, correlationId: null },
    dispatch,
  );
  staleDeferred.resolve({
    ok: true,
    value: { active: [], archived: [], problems: [] },
  });
  await expect(stalePromise).resolves.toBe(false);
  currentDeferred.resolve({
    ok: true,
    value: { active: [activeReview], archived: [], problems: [] },
  });

  await expect(currentPromise).resolves.toBe(true);
  expect(list).toHaveBeenCalledTimes(2);
  expect(
    dispatch.mock.calls
      .map(([event]) => event as UserReviewApplicationEvent)
      .filter((event) => event.type === "listSucceeded"),
  ).toHaveLength(1);
});

test("application serviceはAからBを経てAへ戻った後に古いcreate結果を破棄する", async () => {
  const staleDeferred = createDeferred<ActiveUserReview>();
  const currentDeferred = createDeferred<ActiveUserReview>();
  const currentReview = createActiveUserReview("urv_current");
  const create = vi
    .fn()
    .mockReturnValueOnce(staleDeferred.promise)
    .mockReturnValueOnce(currentDeferred.promise);
  const repository: UserReviewRepository = {
    list: vi.fn(),
    create,
    archive: vi.fn(),
  };
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();
  const input = {
    selectionIdentity,
    workspacePath,
    target,
    commentIds: [commentId] as const,
  };

  const stalePromise = service.create(input, dispatch);
  service.select(otherSelectionIdentity, dispatch);
  service.select(selectionIdentity, dispatch);
  const currentPromise = service.create(input, dispatch);
  staleDeferred.resolve({ ok: true, value: activeReview });
  await expect(stalePromise).resolves.toBeNull();
  currentDeferred.resolve({ ok: true, value: currentReview });

  await expect(currentPromise).resolves.toEqual(currentReview);
  expect(create).toHaveBeenCalledTimes(2);
});

test("application serviceはAからBを経てAへ戻った後に古いarchive結果を破棄する", async () => {
  const staleDeferred = createDeferred<ArchivedUserReview>();
  const currentDeferred = createDeferred<ArchivedUserReview>();
  const currentReview: ArchivedUserReview = {
    ...archivedReview,
    updatedAt: "2026-07-13T11:00:00Z",
    archivedAt: "2026-07-13T11:00:00Z",
  };
  const archive = vi
    .fn()
    .mockReturnValueOnce(staleDeferred.promise)
    .mockReturnValueOnce(currentDeferred.promise);
  const repository: UserReviewRepository = {
    list: vi.fn(),
    create: vi.fn(),
    archive,
  };
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();
  const input = {
    selectionIdentity,
    workspacePath,
    target,
    userReview: activeReview,
  };

  const stalePromise = service.archive(input, dispatch);
  service.select(otherSelectionIdentity, dispatch);
  service.select(selectionIdentity, dispatch);
  const currentPromise = service.archive(input, dispatch);
  staleDeferred.resolve({ ok: true, value: archivedReview });
  await expect(stalePromise).resolves.toBeNull();
  currentDeferred.resolve({ ok: true, value: currentReview });

  await expect(currentPromise).resolves.toEqual(currentReview);
  expect(archive).toHaveBeenCalledTimes(2);
});
test("application serviceはarchive同時実行をrepository前に抑止する", async () => {
  const deferred = createDeferred<ArchivedUserReview>();
  const archive = vi.fn().mockReturnValue(deferred.promise);
  const repository: UserReviewRepository = {
    list: vi.fn(),
    create: vi.fn(),
    archive,
  };
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const events: UserReviewApplicationEvent[] = [];
  const dispatch = (event: UserReviewApplicationEvent): void => {
    events.push(event);
  };

  const first = service.archive(
    { selectionIdentity, workspacePath, target, userReview: activeReview },
    dispatch,
  );
  await expect(
    service.archive(
      { selectionIdentity, workspacePath, target, userReview: activeReview },
      dispatch,
    ),
  ).resolves.toBeNull();
  deferred.resolve({ ok: true, value: archivedReview });

  await expect(first).resolves.toEqual(archivedReview);
  expect(archive).toHaveBeenCalledTimes(1);
  expect(events.map((event) => event.type)).toEqual([
    "archiveStarted",
    "archiveSucceeded",
  ]);
});

test("application serviceはcreate同時実行をrepository前に抑止する", async () => {
  const deferred = createDeferred<ActiveUserReview>();
  const create = vi.fn().mockReturnValue(deferred.promise);
  const repository: UserReviewRepository = {
    list: vi.fn(),
    create,
    archive: vi.fn(),
  };
  const service = createUserReviewApplicationService(
    createUserReviewUseCases(repository),
    selectionIdentity,
  );
  const dispatch = vi.fn();
  const input = {
    selectionIdentity,
    workspacePath,
    target,
    commentIds: [commentId] as const,
  };

  const first = service.create(input, dispatch);
  await expect(service.create(input, dispatch)).resolves.toBeNull();
  deferred.resolve({ ok: true, value: activeReview });

  await expect(first).resolves.toEqual(activeReview);
  expect(create).toHaveBeenCalledTimes(1);
});

function createDeferred<T>(): Readonly<{
  promise: Promise<{ ok: true; value: T }>;
  resolve: (value: { ok: true; value: T }) => void;
}> {
  let resolve = (_value: { ok: true; value: T }): void => {};
  const promise = new Promise<{ ok: true; value: T }>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createRepository(): UserReviewRepository {
  return {
    list: vi.fn(),
    create: vi.fn(),
    archive: vi.fn(),
  };
}

function createActiveUserReview(id: string): ActiveUserReview {
  return {
    schemaVersion: "spec-reviewer.user-review.v1",
    id,
    status: "active",
    target,
    recordLocator: `${id}.json`,
    commentCount: 1,
    createdAt: "2026-07-13T10:00:00Z",
    updatedAt: "2026-07-13T10:00:00Z",
    archivedAt: null,
  };
}
