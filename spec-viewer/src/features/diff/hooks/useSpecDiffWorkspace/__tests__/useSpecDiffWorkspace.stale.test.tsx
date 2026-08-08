import { expect, test, vi } from "vitest";

import { createDiffViewerFixture } from "@/features/diff/components/DiffViewer/testFixtures";
import {
  type SpecDiffWorkspaceApi,
  type UseSpecDiffWorkspaceOptions,
  useSpecDiffWorkspace,
} from "@/features/diff/hooks/useSpecDiffWorkspace";
import type { ListChangedSpecFilesCommandResponse } from "@/lib/api/tauri";
import { flush, renderHook } from "@/lib/test/renderHook";

const STALE_DETAIL_CODES = [
  "staleSnapshot",
  "headChangedDuringRead",
  "staleBase",
  "entryChangedDuringRead",
];

const changedResponse: ListChangedSpecFilesCommandResponse = {
  currentSnapshotId: "rs1_snapshot",
  resolvedBaseSha: "a".repeat(40),
  files: [
    {
      specId: "082-issue-202",
      fileKey: "impl",
      targetPath:
        ".plugin-workspace/.specs/082-issue-202/implementation-plan.md",
      oldPath: "implementation-plan.md",
      newPath: "implementation-plan.md",
      change: "modified",
    },
  ],
};

const selection = { specId: "082-issue-202", fileKey: "impl" } as const;

/**
 * Builds an API whose detail command always rejects with the given code.
 *
 * @param code - Backend error code the detail command rejects with.
 * @returns The stubbed API alongside its two command spies.
 */
function createRejectingApi(code: string): Readonly<{
  api: SpecDiffWorkspaceApi;
  listChangedSpecFiles: SpecDiffWorkspaceApi["listChangedSpecFiles"];
  getSpecFileDiff: SpecDiffWorkspaceApi["getSpecFileDiff"];
}> {
  const listChangedSpecFiles = vi.fn(async () => changedResponse);
  const getSpecFileDiff = vi.fn(async () => {
    throw {
      command: "get_spec_file_diff",
      code,
      message: `${code} rejection`,
      raw: null,
    };
  });

  return {
    api: {
      listChangedSpecFiles,
      getSpecFileDiff:
        getSpecFileDiff as unknown as SpecDiffWorkspaceApi["getSpecFileDiff"],
    },
    listChangedSpecFiles,
    getSpecFileDiff:
      getSpecFileDiff as unknown as SpecDiffWorkspaceApi["getSpecFileDiff"],
  };
}

/**
 * Renders the workspace hook with a stubbed API and a selected changed file.
 *
 * @param api - The stubbed workspace API to inject.
 * @returns The rendered hook handle.
 */
function renderWorkspace(api: SpecDiffWorkspaceApi) {
  return renderHook<
    UseSpecDiffWorkspaceOptions,
    ReturnType<typeof useSpecDiffWorkspace>
  >(useSpecDiffWorkspace, {
    workspacePath: "/workspace",
    selection,
    api,
  });
}

test.each(
  STALE_DETAIL_CODES,
)("detailのstale code=%sはoverviewを1回だけ再取得して回復を試みる", async (code) => {
  const stubs = createRejectingApi(code);
  const handle = renderWorkspace(stubs.api);
  await flush();
  await flush();

  expect(stubs.listChangedSpecFiles).toHaveBeenCalledTimes(2);
  handle.unmount();
});

test("detailのstaleでないerrorはoverviewを再取得しない", async () => {
  const stubs = createRejectingApi("io");
  const handle = renderWorkspace(stubs.api);
  await flush();
  await flush();

  expect(stubs.listChangedSpecFiles).toHaveBeenCalledTimes(1);
  handle.unmount();
});

test("detail成功時はoverviewを再取得しない", async () => {
  const listChangedSpecFiles = vi.fn(async () => changedResponse);
  const getSpecFileDiff = vi.fn(async () => createDiffViewerFixture());
  const handle = renderWorkspace({ listChangedSpecFiles, getSpecFileDiff });
  await flush();
  await flush();

  expect(listChangedSpecFiles).toHaveBeenCalledTimes(1);
  expect(getSpecFileDiff).toHaveBeenCalledTimes(1);
  handle.unmount();
});
