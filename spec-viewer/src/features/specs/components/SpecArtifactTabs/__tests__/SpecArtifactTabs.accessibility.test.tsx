import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { SpecArtifactTabs } from "@/features/specs/components/SpecArtifactTabs";
import type { SpecArtifact } from "@/features/specs/types/spec";

const artifacts: readonly SpecArtifact[] = [
  {
    identity: { kind: "standard", fileKey: "impl" },
    fileKey: "impl",
    fileName: "implementation-plan.md",
    label: "Implementation",
    format: "markdown",
    progress: "notStarted",
    path: "implementation-plan.md",
    contents: "",
    blocks: [],
    error: null,
  },
  {
    identity: { kind: "standard", fileKey: "tasks" },
    fileKey: "tasks",
    fileName: "tasks.md",
    label: "Tasks",
    format: "markdown",
    progress: "inProgress",
    path: "tasks.md",
    contents: "- [ ] next",
    blocks: [],
    error: null,
  },
  {
    identity: { kind: "directMarkdown", fileName: "Done.md" },
    fileKey: null,
    fileName: "Done.md",
    label: "Done",
    format: "markdown",
    progress: "completed",
    path: "Done.md",
    contents: "Done",
    blocks: [],
    error: null,
  },
  {
    identity: { kind: "directMarkdown", fileName: "Broken.md" },
    fileKey: null,
    fileName: "Broken.md",
    label: "Broken",
    format: "markdown",
    progress: "unknown",
    path: "Broken.md",
    contents: null,
    blocks: [],
    error: { code: "markdownRead", message: "Could not read artifact." },
  },
];

function renderTabs(disabled = false) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onSelectArtifact = vi.fn();
  act(() => {
    root.render(
      <SpecArtifactTabs
        specLabel="Issue 194"
        artifacts={artifacts}
        selectedIdentity={artifacts[0]!.identity}
        isSelectionDisabled={disabled}
        onSelectArtifact={onSelectArtifact}
      />,
    );
  });
  return {
    container,
    onSelectArtifact,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test.each([
  ["[R199-SPEC-003] unknown progressを表示する", "Unknown"],
  ["[R199-SPEC-005] processing progressを表示する", "In progress"],
  ["[R199-SPEC-006] completed progressを表示する", "Completed"],
] as const)("%s", (_title, expectedLabel) => {
  const result = renderTabs();

  expect(result.container.textContent).toContain(expectedLabel);
  result.unmount();
});

test("[R199-SPEC-007] failed progressはread errorを公開する", () => {
  const result = renderTabs();
  const tabs = result.container.querySelectorAll('[role="tab"]');

  expect(tabs[3]?.getAttribute("aria-label")).toContain("read error");
  result.unmount();
});

test.each([
  ["ArrowRight", artifacts[1]!.identity],
  ["ArrowLeft", artifacts[3]!.identity],
  ["Home", artifacts[0]!.identity],
  ["End", artifacts[3]!.identity],
] as const)("%sでidentity順に選択する", (key, expectedIdentity) => {
  const result = renderTabs();
  const firstTab = result.container.querySelector('[role="tab"]')!;
  act(() => {
    firstTab.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  });

  expect(result.onSelectArtifact).toHaveBeenCalledWith(expectedIdentity);
  result.unmount();
});

test("disabled中はkeyboardでも選択を変更しない", () => {
  const result = renderTabs(true);
  const firstTab = result.container.querySelector('[role="tab"]')!;
  act(() => {
    firstTab.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  });

  expect(result.onSelectArtifact).not.toHaveBeenCalled();
  result.unmount();
});
