import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffLineCommentControl } from "@/features/diffComments/components/DiffLineCommentControl";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => {
    container.remove();
  });
});

test("[R199-A11Y-002] 空き行はsideとpathとlineを読み上げる追加ボタンを表示する", () => {
  const onStartDraft = vi.fn();
  const view = renderControl({ onStartDraft });
  const addButton = findButton(
    view,
    "src/file.ts current 4行目にコメントを追加",
  );

  expect(addButton.querySelector("svg")).not.toBeNull();
  expect(addButton.textContent).toBe("");

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

test("コメント追加ボタンを別行までドラッグすると範囲targetで入力を開始する", () => {
  const onStartDraft = vi.fn();
  const lines = [4, 5, 6, 7].map(createCommentLine);
  const view = renderControl({ onStartDraft });
  const addButton = findButton(
    view,
    "src/file.ts current 4行目にコメントを追加",
  );
  const originalElementFromPoint = document.elementFromPoint;
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => lines[3],
  });

  act(() => {
    dispatchPointer(addButton, "pointerdown");
    dispatchPointer(addButton, "pointermove");
  });
  expect(lines.map((line) => line.dataset.diffCommentRangePreview)).toEqual([
    "true",
    "true",
    "true",
    "true",
  ]);
  expect(addButton.dataset.diffCommentDragging).toBe("true");

  act(() => dispatchPointer(addButton, "pointerup"));
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: originalElementFromPoint,
  });

  expect(onStartDraft).toHaveBeenCalledWith(
    {
      key: "current:src/file.ts:7",
      side: "current",
      sidePath: "src/file.ts",
      line: 4,
      endLine: 7,
    },
    addButton,
  );
  expect(lines.map((line) => line.dataset.diffCommentRangePreview)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  expect(addButton.dataset.diffCommentDragging).toBeUndefined();
});

test("既存commentがある行はindicatorからcardを選択し同じ行へ追加できる", () => {
  const onStartDraft = vi.fn();
  const onSelectComment = vi.fn();
  const view = renderControl({
    comments: [
      { id: "one", createdAt: "2026-01-01T00:00:00Z", label: "first" },
    ],
    onStartDraft,
    onSelectComment,
  });

  const indicator = findButton(
    view,
    "src/file.ts current 4行目のコメント1件を表示",
  );
  const addButton = findButton(
    view,
    "src/file.ts current 4行目にコメントを追加",
  );
  expect(indicator.dataset.commentCount).toBe("1");
  expect(indicator.title).toBe("src/file.ts current 4行目・未解決コメント1件");
  expect(indicator.querySelector("svg")).not.toBeNull();
  expect(indicator.parentElement?.classList).toContain(
    "diff-line-comment-control-group",
  );
  act(() => indicator.click());
  expect(onSelectComment).toHaveBeenCalledWith("one");
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

  act(() =>
    findButton(view, "src/file.ts current 4行目のコメント3件を選択").click(),
  );
  const options = Array.from(
    view.querySelectorAll<HTMLButtonElement>("[role='menuitem']"),
  );
  expect(options.map((option) => option.textContent)).toEqual([
    "first",
    "same later id",
    "second",
  ]);
  expect(
    findButton(view, "src/file.ts current 4行目にコメントを追加"),
  ).not.toBeNull();
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
  const trigger = findButton(
    view,
    "src/file.ts current 4行目のコメント2件を選択",
  );

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

function createCommentLine(line: number): HTMLElement {
  const element = document.createElement("code");
  element.dataset.diffCommentLineContainer = "true";
  element.dataset.diffCommentCurrentPath = "src/file.ts";
  element.dataset.diffCommentCurrentLine = String(line);
  document.body.append(element);
  containers.push(element);
  return element;
}

function dispatchPointer(
  button: HTMLButtonElement,
  type: "pointerdown" | "pointermove" | "pointerup",
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  button.dispatchEvent(event);
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
