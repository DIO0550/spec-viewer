import { expect, test } from "vitest";

import {
  createWorkspaceDropCandidate,
  extractBrowserDropPaths,
} from "@/features/workspace/infrastructure/workspaceDrop";

test("createWorkspaceDropCandidateは単一のdrop pathをworkspace候補にする", () => {
  const result = createWorkspaceDropCandidate([
    "  file:///workspace/spec-reviewer/  ",
  ]);

  expect(result).toEqual({
    status: "accepted",
    path: "/workspace/spec-reviewer",
  });
});

test("createWorkspaceDropCandidateは不正なfile URLを拒否する", () => {
  const result = createWorkspaceDropCandidate(["file://%"]);

  expect(result).toEqual({
    status: "rejected",
    message: "Drop a workspace folder or paste a filesystem path.",
  });
});

test("createWorkspaceDropCandidateは複数pathを無効なdropとして拒否する", () => {
  const result = createWorkspaceDropCandidate([
    "/workspace/one",
    "/workspace/two",
  ]);

  expect(result).toEqual({
    status: "rejected",
    message: "Drop a single workspace folder.",
  });
});

test("extractBrowserDropPathsはtext plainのfile URLをpathへ変換する", () => {
  const dataTransfer = {
    files: [],
    getData: (type: string) =>
      type === "text/plain" ? "file:///workspace/spec-reviewer" : "",
  } as unknown as DataTransfer;

  const result = extractBrowserDropPaths(dataTransfer);

  expect(result).toEqual(["/workspace/spec-reviewer"]);
});
