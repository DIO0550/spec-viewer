import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { RevisionSelector } from "@/features/diff/components/RevisionSelector";

const sha = "a".repeat(40);
const props = {
  value: { kind: "head" } as const,
  options: [
    {
      id: "head",
      revision: { kind: "head" } as const,
      label: "HEAD",
      resolvedCommitSha: sha,
    },
    {
      id: "localBranch:refs/heads/main",
      revision: { kind: "localBranch", name: "refs/heads/main" } as const,
      label: "main",
      resolvedCommitSha: sha,
    },
    {
      id: "tag:refs/tags/v1",
      revision: { kind: "tag", name: "refs/tags/v1" } as const,
      label: "v1",
      resolvedCommitSha: sha,
    },
  ],
  history: {
    items: [{ sha, committedAt: "2026-08-04T00:00:00Z", message: "message" }],
    truncated: true,
  },
  optionsStatus: "ready" as const,
  historyStatus: "ready" as const,
  isComparing: false,
  errorMessage: null,
  onChange: vi.fn(),
  onRetryOptions: vi.fn(),
  onRetryHistory: vi.fn(),
};

test("RevisionSelectorはHEAD branch tag historyをgroup表示する", () => {
  const result = render(<RevisionSelector {...props} />);
  const trigger = result.container.querySelector("button");
  act(() => trigger?.click());

  expect(trigger?.getAttribute("aria-expanded")).toBe("true");
  expect(result.container.textContent).toContain("Branches");
  expect(result.container.textContent).toContain("Tags");
  expect(result.container.textContent).toContain("ファイル履歴（最新50件）");
  expect(result.container.textContent).toContain("古い履歴は省略されています");
  result.unmount();
});

test("RevisionSelectorはArrowとEnterで選択してtriggerへfocusを戻す", () => {
  const onChange = vi.fn();
  const result = render(<RevisionSelector {...props} onChange={onChange} />);
  const trigger = result.container.querySelector("button");
  act(() => {
    trigger?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  const listbox = result.container.querySelector<HTMLElement>("[role=listbox]");
  act(() => {
    listbox?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  act(() => {
    listbox?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  });

  expect(onChange).toHaveBeenCalledWith({
    kind: "localBranch",
    name: "refs/heads/main",
  });
  expect(document.activeElement).toBe(trigger);
  result.unmount();
});

test("RevisionSelectorはloadingとfailed catalogを独立して通知する", () => {
  const result = render(
    <RevisionSelector
      {...props}
      optionsStatus="failed"
      optionsErrorMessage="refs failure"
      historyStatus="loading"
      errorMessage="comparison failure"
    />,
  );
  act(() => result.container.querySelector("button")?.click());

  expect(result.container.textContent).toContain("refs failure");
  expect(result.container.textContent).toContain("履歴を読み込んでいます");
  expect(result.container.textContent).toContain("comparison failure");
  expect(result.container.querySelectorAll("[role=alert]")).toHaveLength(2);
  result.unmount();
});

test("RevisionSelectorはEscapeで閉じてretry操作を各callbackへ渡す", () => {
  const onRetryOptions = vi.fn();
  const onRetryHistory = vi.fn();
  const result = render(
    <RevisionSelector
      {...props}
      optionsStatus="failed"
      historyStatus="failed"
      onRetryOptions={onRetryOptions}
      onRetryHistory={onRetryHistory}
    />,
  );
  const trigger = result.container.querySelector("button");
  act(() => trigger?.click());
  const retries = [...result.container.querySelectorAll("button")].filter(
    (button) => button.textContent === "再試行",
  );
  act(() => retries[0]?.click());
  act(() => retries[1]?.click());
  const listbox = result.container.querySelector("[role=listbox]");
  act(() => {
    listbox?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onRetryOptions).toHaveBeenCalledOnce();
  expect(onRetryHistory).toHaveBeenCalledOnce();
  expect(result.container.querySelector("[role=listbox]")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  result.unmount();
});

function render(element: ReactElement): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(element));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}
