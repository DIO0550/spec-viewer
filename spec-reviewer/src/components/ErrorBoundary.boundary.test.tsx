import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

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

test("ErrorBoundaryは子コンポーネントの例外を復旧操作付きで表示する", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = renderComponent(
    <ErrorBoundary>
      <ThrowingPanel />
    </ErrorBoundary>,
  );

  expect(result.container.textContent).toContain("Something went wrong");
  expect(result.container.textContent).toContain("Viewer render failed.");

  result.rerender(
    <ErrorBoundary>
      <StablePanel />
    </ErrorBoundary>,
  );

  act(() => {
    (
      Array.from(result.container.querySelectorAll("button")).find(
        (button) => button.textContent === "Try again",
      ) as HTMLButtonElement
    ).click();
  });

  expect(result.container.textContent).toContain("Recovered viewer");
  result.unmount();
  consoleError.mockRestore();
});
