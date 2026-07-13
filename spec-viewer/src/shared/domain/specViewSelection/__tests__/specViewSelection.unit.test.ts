import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import {
  SelectionIdentity,
  SpecViewSelection,
} from "@/shared/domain/specViewSelection";
import { WorkspacePath } from "@/shared/domain/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");

test("workspace・spec・fileの明示transitionは下流選択とscopeをresetする", () => {
  const workspaceSelection = SpecViewSelection.selectWorkspace(
    SpecViewSelection.empty(),
    workspacePath,
  );
  const specSelection = SpecViewSelection.selectSpec(
    workspaceSelection,
    TestValues.specId("auth"),
  );
  const fileSelection = SpecViewSelection.selectFile(specSelection, "tasks");
  const specScopeSelection = SpecViewSelection.selectTargetScope(
    fileSelection,
    "spec",
  );
  const nextSpecSelection = SpecViewSelection.selectSpec(
    specScopeSelection,
    TestValues.specId("billing"),
  );
  const nextFileSelection = SpecViewSelection.selectFile(
    SpecViewSelection.selectTargetScope(fileSelection, "spec"),
    "impl",
  );

  expect(workspaceSelection).toMatchObject({
    workspacePath,
    specId: null,
    fileKey: null,
    targetScope: "file",
  });
  expect(specSelection).toMatchObject({
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: null,
    targetScope: "file",
  });
  expect(nextSpecSelection).toMatchObject({
    specId: TestValues.specId("billing"),
    fileKey: null,
    targetScope: "file",
  });
  expect(nextFileSelection).toMatchObject({
    specId: TestValues.specId("auth"),
    fileKey: "impl",
    targetScope: "file",
  });
});

test("workspace resetはaggregateを初期状態へ戻す", () => {
  const selected = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });

  expect(SpecViewSelection.resetWorkspace(selected)).toEqual(
    SpecViewSelection.empty(),
  );
});

test("incomplete selectionからfile・comment・watch・review targetを作れない", () => {
  const workspaceSelection = SpecViewSelection.selectWorkspace(
    SpecViewSelection.empty(),
    workspacePath,
  );
  const specSelection = SpecViewSelection.selectSpec(
    workspaceSelection,
    TestValues.specId("auth"),
  );

  expect(SpecViewSelection.fileTarget(workspaceSelection)).toBeNull();
  expect(SpecViewSelection.commentTarget(specSelection)).toBeNull();
  expect(SpecViewSelection.watchTarget(specSelection)).toBeNull();
  expect(SpecViewSelection.reviewTarget(workspaceSelection)).toBeNull();
});

test("complete selectionからvalidated targetを導出する", () => {
  const fileSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath,
      specId: TestValues.specId("auth"),
      fileKey: "tasks",
    },
  );
  const specSelection = SpecViewSelection.selectTargetScope(
    fileSelection,
    "spec",
  );

  expect(SpecViewSelection.commentTarget(fileSelection)).toMatchObject({
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });
  expect(SpecViewSelection.watchTarget(fileSelection)).toMatchObject({
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });
  expect(SpecViewSelection.reviewTarget(fileSelection)).toMatchObject({
    scope: "file",
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });
  expect(SpecViewSelection.reviewTarget(specSelection)).toMatchObject({
    scope: "spec",
    workspacePath,
    specId: TestValues.specId("auth"),
  });
});

test("SelectionIdentityは区切り文字を含む値でも衝突しない", () => {
  const first = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString("/workspace/a:file"),
    specId: TestValues.specId("b"),
    fileKey: "tasks",
  });
  const second = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath: WorkspacePath.fromString("/workspace/a"),
    specId: TestValues.specId("file|b"),
    fileKey: "tasks",
  });

  expect(
    SelectionIdentity.equals(
      SelectionIdentity.fromSelection(first),
      SelectionIdentity.fromSelection(second),
    ),
  ).toBe(false);
});

test("SelectionIdentityはworkspace・spec・file・scopeの全差分を表す", () => {
  const base = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath,
    specId: TestValues.specId("auth"),
    fileKey: "tasks",
  });
  const identities = [
    base,
    SpecViewSelection.selectWorkspace(
      base,
      WorkspacePath.fromString("/workspace/other"),
    ),
    SpecViewSelection.selectSpec(base, TestValues.specId("billing")),
    SpecViewSelection.selectFile(base, "impl"),
    SpecViewSelection.selectTargetScope(base, "spec"),
  ].map(SelectionIdentity.fromSelection);

  expect(new Set(identities).size).toBe(identities.length);
});
