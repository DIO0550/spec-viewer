import { expect, test } from "vitest";

import {
  CommentScope,
  type CommentScope as CommentScopeType,
} from "@/features/comments/domain/commentScope";
import {
  SelectionIdentity,
  SpecViewSelection,
} from "@/features/specs/domain/specViewSelection";
import { WorkspacePath } from "@/domains/workspacePath";

const workspacePath = WorkspacePath.fromString("/workspace/spec-reviewer");

test("CommentScope.fromSelectionはcomplete file selectionからscopeを作成する", () => {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath,
    specId: "auth",
    fileKey: "tasks",
  });

  expect(CommentScope.fromSelection(selection)).toEqual({
    workspacePath: "/workspace/spec-reviewer",
    specId: "auth",
    fileKey: "tasks",
    selectionIdentity: SelectionIdentity.fromSelection(selection),
  });
});

test.each([
  SpecViewSelection.empty(),
  SpecViewSelection.selectWorkspace(SpecViewSelection.empty(), workspacePath),
  SpecViewSelection.selectSpec(
    SpecViewSelection.selectWorkspace(SpecViewSelection.empty(), workspacePath),
    "auth",
  ),
])("CommentScope.fromSelectionはincomplete selectionならnullを返す", (selection) => {
  expect(CommentScope.fromSelection(selection)).toBeNull();
});

test("CommentScope.selectionIdentityはaggregateと同じbranded identityを返す", () => {
  const selection = SpecViewSelection.synchronize(SpecViewSelection.empty(), {
    workspacePath,
    specId: "auth",
    fileKey: "tasks",
  });
  const scope = CommentScope.fromSelection(selection) as CommentScopeType;

  expect(scope).not.toBeNull();

  expect(
    SelectionIdentity.equals(
      CommentScope.selectionIdentity(scope),
      SelectionIdentity.fromSelection(selection),
    ),
  ).toBe(true);
});

test("CommentScopeはtargetScopeを含むaggregate identityを保持する", () => {
  const fileSelection = SpecViewSelection.synchronize(
    SpecViewSelection.empty(),
    {
      workspacePath,
      specId: "auth",
      fileKey: "tasks",
    },
  );
  const specSelection = SpecViewSelection.selectTargetScope(
    fileSelection,
    "spec",
  );
  const fileScope = CommentScope.fromSelection(
    fileSelection,
  ) as CommentScopeType;
  const specScope = CommentScope.fromSelection(
    specSelection,
  ) as CommentScopeType;

  expect(
    SelectionIdentity.equals(
      specScope.selectionIdentity,
      SelectionIdentity.fromSelection(specSelection),
    ),
  ).toBe(true);
  expect(
    SelectionIdentity.equals(
      fileScope.selectionIdentity,
      specScope.selectionIdentity,
    ),
  ).toBe(false);
});
