import { expect, test } from "vitest";

import { SpecDocumentState } from "@/features/specs/domain/specDocumentState";
import { SpecTreeState } from "@/features/specs/domain/specTreeState";
import { buildSpecsSelectors } from "@/features/specs/hooks/useSpecs/selectors";
import type { SpecsState } from "@/features/specs/hooks/useSpecs/types";
import type { SpecTreeData } from "@/features/specs";

const tree: SpecTreeData = {
  specs: [
    {
      id: "phase-1",
      label: "Phase 1",
      kind: "spec",
      sourceGroupId: "primary",
      relativeId: "phase-1",
      presentDocumentCount: 0,
      descendantSpecCount: 0,
      files: [
        {
          key: "impl",
          label: "Implementation",
          fileName: "implementation-plan.md",
          status: "present",
        },
        {
          key: "tasks",
          label: "Tasks",
          fileName: "tasks.md",
          status: "present",
        },
      ],
      children: [],
    },
  ],
};

const baseState: SpecsState = {
  specTreeState: SpecTreeState.loaded("/workspace/spec-reviewer", tree),
  documentState: SpecDocumentState.idle("/workspace/spec-reviewer"),
  selection: {
    specId: "phase-1",
    fileKey: "tasks",
  },
  isLoading: false,
  activeOperationId: null,
  archivingSpecId: null,
  archiveSpecError: null,
  archiveFailure: null,
  archiveReveal: null,
};

test("buildSpecsSelectorsはtreeとselectionからselected spec/fileを導出する", () => {
  const selectors = buildSpecsSelectors(baseState);

  expect(selectors.selectedSpec?.label).toBe("Phase 1");
  expect(selectors.selectedFile?.label).toBe("Tasks");
  expect(selectors.isLoading).toBe(false);
  expect(selectors.canReloadDocument).toBe(true);
});

test("buildSpecsSelectorsは未選択やloading中にreload不可を返す", () => {
  const selectors = buildSpecsSelectors({
    ...baseState,
    selection: {
      specId: null,
      fileKey: null,
    },
    isLoading: true,
  });

  expect(selectors.selectedSpec).toBeNull();
  expect(selectors.selectedFile).toBeNull();
  expect(selectors.isLoading).toBe(true);
  expect(selectors.canReloadDocument).toBe(false);
});
