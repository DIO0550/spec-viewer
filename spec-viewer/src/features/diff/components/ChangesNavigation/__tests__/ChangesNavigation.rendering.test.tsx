import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { ChangesNavigation } from "@/features/diff/components/ChangesNavigation";

test.each([
  [
    "contract-pending",
    "Changesの契約を確認中です。Specsモードで仕様の確認を続けられます。",
  ],
  [
    "data-source-not-connected",
    "変更ファイル一覧はまだ利用できません。Specsモードで仕様の確認を続けられます。",
  ],
] as const)("Changesのunavailable理由 %s を通知する", (reason, message) => {
  const result = renderChanges(
    <ChangesNavigation
      items={[]}
      selectedId={null}
      availability={{ status: "unavailable", reason }}
      onSelect={vi.fn()}
    />,
  );

  const status = result.container.querySelector('[role="status"]');
  expect(status?.getAttribute("aria-label")).toBe("Changesデータ状態");
  expect(status?.textContent).toBe(message);
  result.unmount();
});

test("readyで0 filesなら変更ファイルなしを通知する", () => {
  const result = renderChanges(
    <ChangesNavigation
      items={[]}
      selectedId={null}
      availability={{ status: "ready" }}
      onSelect={vi.fn()}
    />,
  );

  expect(result.container.querySelector('[role="status"]')?.textContent).toBe(
    "変更ファイルはありません。",
  );
  result.unmount();
});

function renderChanges(element: ReactElement): Readonly<{
  container: HTMLDivElement;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}
