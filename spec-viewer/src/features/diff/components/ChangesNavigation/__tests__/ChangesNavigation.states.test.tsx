import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ChangesNavigation } from "@/features/diff/components/ChangesNavigation";
import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";

test.each([
  ["added", "U", "追加"],
  ["modified", "M", "変更"],
  ["deleted", "M", "削除"],
  ["renamed", "M", "名前変更"],
  ["copied", "M", "コピー"],
  ["typeChanged", "M", "種別変更"],
  ["untracked", "U", "未追跡"],
] as const)("change=%sをtoken=%sとlabel=%sで表示する", (change, token, label) => {
  const { container, unmount } = renderNavigation({
    availability: { status: "ready" },
    items: [{ id: change, path: `${change}.md`, change }],
  });

  const marker = container.querySelector(`[aria-label="${label}"]`);
  expect(marker?.textContent).toBe(token);
  unmount();
});

test("failedはmessageとretry actionを表示する", () => {
  const onRetry = vi.fn();
  const { container, unmount } = renderNavigation({
    availability: { status: "failed", message: "取得に失敗しました" },
    onRetry,
  });

  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "取得に失敗しました",
  );
  act(() => {
    container.querySelector<HTMLButtonElement>("button")?.click();
  });
  expect(onRetry).toHaveBeenCalledOnce();
  unmount();
});

function renderNavigation(
  options: Readonly<{
    availability:
      | Readonly<{ status: "ready" }>
      | Readonly<{ status: "failed"; message: string }>;
    items?: readonly Readonly<{
      id: string;
      path: string;
      change: FileChangeStatus;
    }>[];
    onRetry?: () => void;
  }>,
): Readonly<{ container: HTMLDivElement; unmount: () => void }> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <ChangesNavigation
        items={options.items ?? []}
        selectedId={null}
        availability={options.availability}
        onSelect={vi.fn()}
        onRetry={options.onRetry}
      />,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
    },
  };
}
