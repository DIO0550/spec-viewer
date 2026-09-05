import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { DiffViewModeControls } from "@/features/diff/components/DiffViewModeControls";

function renderControls(): Readonly<{
  container: HTMLDivElement;
  buttons: () => HTMLButtonElement[];
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Harness(): React.ReactElement {
    const [mode, setMode] = useState<"unified" | "split" | "editor">("unified");
    return (
      <DiffViewModeControls
        mode={mode}
        disabled={false}
        onModeChange={setMode}
      />
    );
  }

  act(() => root.render(<Harness />));
  return {
    container,
    buttons: () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
      ),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("Unified・Split・Editorのcontrolled radiogroupを描画する", () => {
  const view = renderControls();

  expect(
    view.container
      .querySelector('[role="radiogroup"]')
      ?.getAttribute("aria-label"),
  ).toBe("ファイル表示形式");
  expect(view.buttons().map((button) => button.textContent)).toEqual([
    "Unified",
    "Split",
    "Editor",
  ]);
  expect(view.buttons()[0]?.getAttribute("aria-checked")).toBe("true");
  view.unmount();
});

test.each([
  ["ArrowRight", "Split"],
  ["ArrowLeft", "Editor"],
  ["Home", "Unified"],
  ["End", "Editor"],
] as const)("keyboard %sでmodeとfocusを移動する", (key, expected) => {
  const view = renderControls();
  const current = view.buttons()[0];
  act(() => {
    current?.focus();
    current?.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  });

  const selected = view
    .buttons()
    .find((button) => button.getAttribute("aria-checked") === "true");
  expect(selected?.textContent).toBe(expected);
  expect(document.activeElement).toBe(selected);
  view.unmount();
});
