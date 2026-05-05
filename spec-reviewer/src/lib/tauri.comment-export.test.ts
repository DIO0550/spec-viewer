import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { expect, test, vi } from "vitest";

import type { ExportCommentsRequest } from "../types/comment";
import { exportComments, selectCommentExportDestination } from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const saveMock = vi.mocked(save);

test("selectCommentExportDestinationはfile export用のMarkdown保存先を選ぶ", async () => {
  saveMock.mockReset();
  saveMock.mockResolvedValue("/tmp/auth-tasks-comments.md");

  const result = await selectCommentExportDestination({
    scope: "file",
    specId: "auth/tasks",
    fileKey: "tasks",
  });

  expect(result).toBe("/tmp/auth-tasks-comments.md");
  expect(saveMock).toHaveBeenCalledWith({
    title: "Export comments",
    defaultPath: "auth-tasks-tasks-comments.md",
    filters: [
      {
        name: "Markdown",
        extensions: ["md"],
      },
    ],
  });
});

test("selectCommentExportDestinationはworkspace export用のJSON保存先を選ぶ", async () => {
  saveMock.mockReset();
  saveMock.mockResolvedValue("/tmp/workspace-comments.json");

  const result = await selectCommentExportDestination({
    scope: "workspace",
  });

  expect(result).toBe("/tmp/workspace-comments.json");
  expect(saveMock).toHaveBeenCalledWith({
    title: "Export comments",
    defaultPath: "workspace-comments.json",
    filters: [
      {
        name: "JSON",
        extensions: ["json"],
      },
    ],
  });
});

test("exportCommentsはbackend commandへrequestを渡す", async () => {
  const request: ExportCommentsRequest = {
    workspacePath: "/workspace/project",
    target: {
      scope: "spec",
      specId: "auth",
    },
    destinationPath: "/tmp/auth-comments.md",
  };
  const response = {
    destinationPath: "/tmp/auth-comments.md",
    format: "markdown" as const,
    commentCount: 3,
  };
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(response);

  const result = await exportComments(request);

  expect(result).toEqual(response);
  expect(invokeMock).toHaveBeenCalledWith("export_comments", {
    request,
  });
});
