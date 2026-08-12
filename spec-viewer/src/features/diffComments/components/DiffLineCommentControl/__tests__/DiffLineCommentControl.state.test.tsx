import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffLineCommentControl } from "@/features/diffComments/components/DiffLineCommentControl";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => container.remove());
});

test("空き行はsideとpathとlineを読み上げる追加ボタンを表示する", () => {
  const onStartDraft = vi.fn();
  const view = renderControl({ onStartDraft });
  const addButton = findButton(
    view,
    "src/file.ts current 4行目にコメントを追加",
  );

  act(() => addButton.click());

  expect(onStartDraft).toHaveBeenCalledWith(
    {
      key: "current:src/file.ts:4",
      side: "current",
      sidePath: "src/file.ts",
      line: 4,
    },
    addButton,
  );
});

test("既存commentがある行は追加を隠してindicatorからcardを選択する", () => {
  const onSelectComment = vi.fn();
  const view = renderControl({
    comments: [
      { id: "one", createdAt: "2026-01-01T00:00:00Z", label: "first" },
    ],
    onSelectComment,
  });

  expect(view.textContent).not.toContain("コメントを追加");
  act(() => findButton(view, "コメント1件を表示").click());
  expect(onSelectComment).toHaveBeenCalledWith("one");
});

test("収束したcommentはcreatedAtとID順のpickerで選べる", () => {
  const onSelectComment = vi.fn();
  const view = renderControl({
    comments: [
      { id: "b", createdAt: "2026-01-02T00:00:00Z", label: "second" },
      { id: "z", createdAt: "2026-01-01T00:00:00Z", label: "same later id" },
      { id: "a", createdAt: "2026-01-01T00:00:00Z", label: "first" },
    ],
    onSelectComment,
  });

  act(() => findButton(view, "コメント3件を選択").click());
  const options = Array.from(
    view.querySelectorAll<HTMLButtonElement>("[role='menuitem']"),
  );
  expect(options.map((option) => option.textContent)).toEqual([
    "first",
    "same later id",
    "second",
  ]);
  act(() => options[1]?.click());
  expect(onSelectComment).toHaveBeenCalledWith("z");
});

test("収束pickerはArrowで巡回しEscapeで閉じてtriggerへfocusを戻す", () => {
  const view = renderControl({
    comments: [
      { id: "a", createdAt: "2026-01-01T00:00:00Z", label: "first" },
      { id: "b", createdAt: "2026-01-02T00:00:00Z", label: "second" },
    ],
    activeCommentId: "b",
  });
  const trigger = findButton(view, "コメント2件を選択");

  act(() => trigger.click());
  const options = Array.from(
    view.querySelectorAll<HTMLButtonElement>("[role='menuitem']"),
  );
  expect(document.activeElement).toBe(options[0]);
  expect(trigger.getAttribute("aria-current")).toBe("true");

  act(() => {
    options[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(options[1]);

  act(() => {
    options[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
  });
  expect(document.activeElement).toBe(options[0]);

  act(() => {
    options[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  expect(view.querySelector("[role='menu']")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

function renderControl(
  overrides: Partial<Parameters<typeof DiffLineCommentControl>[0]> = {},
): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DiffLineCommentControl
        target={{
          key: "current:src/file.ts:4",
          side: "current",
          sidePath: "src/file.ts",
          line: 4,
        }}
        comments={[]}
        activeCommentId={null}
        onStartDraft={() => undefined}
        onSelectComment={() => undefined}
        {...overrides}
      />,
    );
  });
  return container;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (button === undefined) {
    throw new Error(`button not found: ${label}`);
  }
  return button;
}
