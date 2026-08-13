import { nativeToolingSpikeFixtureRoot } from "../wdio.native.conf";

type WorkspaceResponse = {
  readonly root: string;
  readonly kind: string;
};

type RepositoryResponse = {
  readonly repositoryId: string;
  readonly diffReviewIdentity: Readonly<{
    worktreeId: string;
    currentSnapshotId: string;
  }>;
  readonly changed: readonly Readonly<{ newPath: string | null }>[];
};

it("[R199-NATIVE-001] native app executes load_workspace round-trip", async () => {
  const workspace = await browser.executeAsync<WorkspaceResponse>(
    (selectedDirectory: string, done: (result: WorkspaceResponse) => void) => {
      const internals = (
        window as typeof window & {
          __TAURI_INTERNALS__: {
            invoke: <T>(command: string, args: unknown) => Promise<T>;
          };
        }
      ).__TAURI_INTERNALS__;

      void internals
        .invoke<WorkspaceResponse>("load_workspace", {
          request: { selectedDirectory },
        })
        .then(done);
    },
    nativeToolingSpikeFixtureRoot,
  );

  expect(workspace.kind).toBe("plugin-workspace");
  expect(workspace.root).toBe(nativeToolingSpikeFixtureRoot);

  const repository = await browser.executeAsync<RepositoryResponse>(
    (worktreeId: string, done: (result: RepositoryResponse) => void) => {
      const internals = (
        window as typeof window & {
          __TAURI_INTERNALS__: {
            invoke: <T>(command: string, args: unknown) => Promise<T>;
          };
        }
      ).__TAURI_INTERNALS__;
      void internals
        .invoke<RepositoryResponse>("load_repository_diff", {
          request: { worktreeId, baseOverride: "main" },
        })
        .then(done);
    },
    nativeToolingSpikeFixtureRoot,
  );
  expect(repository.repositoryId).toMatch(/^rr1_[0-9a-f]{64}$/);
  expect(repository.diffReviewIdentity.worktreeId).toMatch(
    /^rw1_[0-9a-f]{64}$/,
  );
  expect(
    repository.changed.some(({ newPath }) => newPath === "review.md"),
  ).toBe(true);
});
