import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { ErrorBoundary } from "@/components/ErrorBoundary";

type RenderResult = Readonly<{
  container: HTMLDivElement;
  rerender: (component: ReactNode) => void;
  unmount: () => void;
}>;

function renderComponent(component: ReactNode): RenderResult {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(component);
  });

  return {
    container,
    rerender: (nextComponent) => {
      act(() => {
        root.render(nextComponent);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function ThrowingPanel(): ReactNode {
  throw new Error("Viewer render failed.");
}

function StablePanel(): ReactNode {
  return <p>Recovered viewer</p>;
}

test("dialog表示の描画エラーは周辺操作を残し閉じられる", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = renderComponent(
    <div>
      <button type="button">Diffへ切り替え</button>
      <ErrorBoundary variant="dialog">
        <ThrowingPanel />
      </ErrorBoundary>
    </div>,
  );

  expect(result.container.querySelector("[role=alertdialog]")).not.toBeNull();
  expect(
    result.container.querySelector("[aria-label=描画エラーダイアログを閉じる]"),
  ).not.toBeNull();
  expect(document.activeElement?.getAttribute("aria-label")).toBe(
    "描画エラーダイアログを閉じる",
  );
  expect(result.container.textContent).toContain("Diffへ切り替え");

  act(() => {
    result.container
      .querySelector<HTMLButtonElement>(
        "[aria-label=描画エラーダイアログを閉じる]",
      )
      ?.click();
  });

  expect(result.container.querySelector("[role=alertdialog]")).toBeNull();
  expect(result.container.textContent).toContain(
    "レビュー本文を表示できません",
  );
  expect(result.container.textContent).toContain("Diffへ切り替え");
  result.unmount();
  consoleError.mockRestore();
});

test("ErrorBoundaryは子コンポーネントの例外を復旧操作付きで表示する", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = renderComponent(
    <ErrorBoundary>
      <ThrowingPanel />
    </ErrorBoundary>,
  );

  expect(result.container.textContent).toContain("問題が発生しました");
  expect(result.container.textContent).toContain("Viewer render failed.");

  result.rerender(
    <ErrorBoundary>
      <StablePanel />
    </ErrorBoundary>,
  );

  act(() => {
    (
      Array.from(result.container.querySelectorAll("button")).find(
        (button) => button.textContent === "再試行",
      ) as HTMLButtonElement
    ).click();
  });

  expect(result.container.textContent).toContain("Recovered viewer");
  result.unmount();
  consoleError.mockRestore();
});
