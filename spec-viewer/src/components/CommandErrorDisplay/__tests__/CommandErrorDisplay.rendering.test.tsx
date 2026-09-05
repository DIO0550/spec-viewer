import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { CommandErrorDisplay } from "@/components/CommandErrorDisplay";

type RenderResult = Readonly<{
  container: HTMLDivElement;
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
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

test("CommandErrorDisplayはエラーコードの詳細ラベルをCodeとして表示する", () => {
  const result = renderComponent(
    <CommandErrorDisplay
      title="読み込みに失敗しました"
      error={{ code: "workspaceDetection", message: "workspace not found" }}
    />,
  );

  expect(result.container.querySelector("dt")?.textContent).toBe("Code");
  expect(result.container.querySelector("dd")?.textContent).toBe(
    "workspaceDetection",
  );

  result.unmount();
});
