import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  type NavigableSpec,
  type UseSpecViewKeyboardNavigationOptions,
  useSpecViewKeyboardNavigation,
} from "@/app/App/hooks/useSpecViewKeyboardNavigation";

function renderHook(options: UseSpecViewKeyboardNavigationOptions): {
  unmount: () => void;
} {
  const container = document.createElement("div");
  const root = createRoot(container);

  function TestComponent(): null {
    useSpecViewKeyboardNavigation(options);
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

function dispatchShortcut(key: string): void {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key, altKey: true, bubbles: true }),
    );
  });
}

const spec: NavigableSpec = {
  files: [
    {
      key: "hearing",
      label: "Hearing",
      fileName: "hearing.md",
      status: "present",
    },
    {
      key: "impl",
      label: "Implementation",
      fileName: "impl.md",
      status: "present",
    },
    { key: "tasks", label: "Tasks", fileName: "tasks.md", status: "present" },
  ],
};

function baseOptions(): UseSpecViewKeyboardNavigationOptions {
  return {
    isCurrentViewLoading: false,
    selectedSpec: spec,
    selectedFileKey: "impl",
    selectFileKey: vi.fn(async () => {}),
    selectAdjacentComment: vi.fn(() => true),
  };
}

test("次のファイルショートカットで隣のfileKeyがselectFileKeyへ渡る", () => {
  const options = baseOptions();
  const hook = renderHook(options);

  dispatchShortcut("ArrowRight");

  expect(options.selectFileKey).toHaveBeenCalledWith("tasks");
  hook.unmount();
});

test("前のファイルショートカットで前のfileKeyがselectFileKeyへ渡る", () => {
  const options = baseOptions();
  const hook = renderHook(options);

  dispatchShortcut("ArrowLeft");

  expect(options.selectFileKey).toHaveBeenCalledWith("hearing");
  hook.unmount();
});

test("末尾で次へ送ると先頭のfileKeyへ循環する", () => {
  const options = { ...baseOptions(), selectedFileKey: "tasks" as const };
  const hook = renderHook(options);

  dispatchShortcut("ArrowRight");

  expect(options.selectFileKey).toHaveBeenCalledWith("hearing");
  hook.unmount();
});

test("先頭で前へ送ると末尾のfileKeyへ循環する", () => {
  const options = { ...baseOptions(), selectedFileKey: "hearing" as const };
  const hook = renderHook(options);

  dispatchShortcut("ArrowLeft");

  expect(options.selectFileKey).toHaveBeenCalledWith("tasks");
  hook.unmount();
});

test("現在キーがfilesに無い場合はindex0起点で次のファイルへ移動する", () => {
  const options = { ...baseOptions(), selectedFileKey: null };
  const hook = renderHook(options);

  dispatchShortcut("ArrowRight");

  expect(options.selectFileKey).toHaveBeenCalledWith("impl");
  hook.unmount();
});

test.each([
  ["loading中", { isCurrentViewLoading: true }],
  ["spec未選択", { selectedSpec: null }],
  ["files空", { selectedSpec: { files: [] } as NavigableSpec }],
])("ガード（%s）ではselectFileKeyが呼ばれない", (_label, overrides) => {
  const options = { ...baseOptions(), ...overrides };
  const hook = renderHook(options);

  dispatchShortcut("ArrowRight");

  expect(options.selectFileKey).not.toHaveBeenCalled();
  hook.unmount();
});

test.each([
  ["ArrowDown", "next"],
  ["ArrowUp", "previous"],
])("コメント送りショートカット（%s）でselectAdjacentCommentが%s方向で呼ばれる", (key, direction) => {
  const options = baseOptions();
  const hook = renderHook(options);

  dispatchShortcut(key);

  expect(options.selectAdjacentComment).toHaveBeenCalledWith(direction);
  hook.unmount();
});
