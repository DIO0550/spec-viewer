import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import {
  RepositoryFileTabs,
  type RepositoryFileTabItem,
} from "@/features/repositoryDiff/components/RepositoryFileTabs";

const items: readonly RepositoryFileTabItem[] = [
  { path: "src/a.ts", change: "added" },
  { path: "src/b.ts", change: "modified" },
  { path: "src/c.ts", change: "deleted" },
];

function renderTabs(): Readonly<{
  container: HTMLDivElement;
  tabs: () => HTMLButtonElement[];
  closeButtons: () => HTMLButtonElement[];
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Harness(): React.ReactElement {
    const [openItems, setOpenItems] = useState(items);
    const [activePath, setActivePath] = useState<string | null>("src/b.ts");
    const close = (path: string): void => {
      setOpenItems((current) => current.filter((item) => item.path !== path));
      setActivePath((current) => {
        if (current !== path) {
          return current;
        }
        const index = openItems.findIndex((item) => item.path === path);
        return openItems[index + 1]?.path ?? openItems[index - 1]?.path ?? null;
      });
    };

    return (
      <RepositoryFileTabs
        items={openItems}
        activePath={activePath}
        onActivate={setActivePath}
        onClose={close}
      />
    );
  }

  act(() => root.render(<Harness />));
  return {
    container,
    tabs: () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')),
    closeButtons: () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          ".repository-file-tab__close",
        ),
      ),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("status文字付きARIA tabsと単一panel参照を描画する", () => {
  const view = renderTabs();
  const tablist = view.container.querySelector('[role="tablist"]');
  const tabs = view.tabs();

  expect(tablist?.getAttribute("aria-label")).toBe("開いている変更ファイル");
  expect(tabs.map((tab) => tab.textContent)).toEqual([
    "Asrc/a.ts",
    "Msrc/b.ts",
    "Dsrc/c.ts",
  ]);
  expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  expect(tabs[1]?.tabIndex).toBe(0);
  expect(tabs[0]?.getAttribute("aria-controls")).toBe("repository-diff-panel");
  view.unmount();
});

test.each([
  ["ArrowRight", "src/c.ts"],
  ["ArrowLeft", "src/a.ts"],
  ["Home", "src/a.ts"],
  ["End", "src/c.ts"],
] as const)("keyboard %sでfocusとactiveを移動する", (key, expected) => {
  const view = renderTabs();
  const active = view.tabs()[1];
  act(() => {
    active?.focus();
    active?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

  const selected = view
    .tabs()
    .find((tab) => tab.getAttribute("aria-selected") === "true");
  expect(selected?.textContent).toContain(expected);
  expect(document.activeElement).toBe(selected);
  view.unmount();
});

test.each([
  ["Delete", false, false],
  ["w", true, false],
  ["w", false, true],
] as const)("%s shortcutでactive tabを閉じ右隣へfocusする", (key, ctrlKey, metaKey) => {
  const view = renderTabs();
  const active = view.tabs()[1];
  act(() => {
    active?.focus();
    active?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        ctrlKey,
        metaKey,
        bubbles: true,
      }),
    );
  });

  expect(view.tabs().map((tab) => tab.textContent)).toEqual([
    "Asrc/a.ts",
    "Dsrc/c.ts",
  ]);
  expect(document.activeElement?.textContent).toContain("src/c.ts");
  view.unmount();
});

test("close buttonは対象tabだけを閉じinactive closeではfocusを変えない", () => {
  const view = renderTabs();
  const active = view.tabs()[1];
  act(() => {
    active?.focus();
    view.closeButtons()[0]?.click();
  });

  expect(view.tabs().map((tab) => tab.textContent)).toEqual([
    "Msrc/b.ts",
    "Dsrc/c.ts",
  ]);
  expect(document.activeElement?.textContent).toContain("src/b.ts");
  view.unmount();
});
