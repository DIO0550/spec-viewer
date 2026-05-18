import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { CommentPopover } from "@/features/comments/components/CommentPopover";

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

type RenderPopoverOptions = Readonly<{
  onClose?: () => void;
  isDismissDisabled?: boolean;
}>;

function renderPopover({
  onClose = vi.fn(),
  isDismissDisabled = false,
}: RenderPopoverOptions = {}): RenderResult {
  return renderComponent(
    <CommentPopover
      className="add-comment-popover"
      style={{ top: 10, left: 20 }}
      role="dialog"
      aria-labelledby="comment-title"
      isDismissDisabled={isDismissDisabled}
      onClose={onClose}
    >
      <button type="button">Inside action</button>
    </CommentPopover>,
  );
}

function findPopover(container: ParentNode): HTMLElement {
  return container.querySelector(".add-comment-popover") as HTMLElement;
}

test("CommentPopoverはasideへclassNameとstyleとroleとariaを渡す", () => {
  const result = renderPopover();
  const popover = findPopover(result.container);

  expect(popover.tagName).toBe("ASIDE");
  expect(popover.className).toBe("add-comment-popover");
  expect(popover.style.top).toBe("10px");
  expect(popover.style.left).toBe("20px");
  expect(popover.getAttribute("role")).toBe("dialog");
  expect(popover.getAttribute("aria-labelledby")).toBe("comment-title");
  result.unmount();
});

test("CommentPopoverはclassNameとstyleを省略してasideを描画する", () => {
  const result = renderComponent(
    <CommentPopover onClose={vi.fn()}>
      <span>Content</span>
    </CommentPopover>,
  );

  expect(result.container.firstElementChild?.tagName).toBe("ASIDE");
  expect(result.container.textContent).toContain("Content");
  result.unmount();
});

test("CommentPopoverは外部mousedownでonCloseを呼ぶ", () => {
  const onClose = vi.fn();
  const result = renderPopover({ onClose });

  act(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onClose).toHaveBeenCalledOnce();
  result.unmount();
});

test("CommentPopoverは内部mousedownではonCloseを呼ばない", () => {
  const onClose = vi.fn();
  const result = renderPopover({ onClose });
  const popover = findPopover(result.container);

  act(() => {
    popover.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onClose).not.toHaveBeenCalled();
  result.unmount();
});

test("CommentPopoverはEscapeではonCloseを呼ばない", () => {
  const onClose = vi.fn();
  const result = renderPopover({ onClose });
  const popover = findPopover(result.container);

  act(() => {
    popover.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });

  expect(onClose).not.toHaveBeenCalled();
  result.unmount();
});

test("CommentPopoverはisDismissDisabled=trueでは外部mousedownでonCloseを呼ばない", () => {
  const onClose = vi.fn();
  const result = renderPopover({ onClose, isDismissDisabled: true });

  act(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });

  expect(onClose).not.toHaveBeenCalled();
  result.unmount();
});

test("CommentPopoverは追加wrapperを作らずasideをrootとして描画する", () => {
  const result = renderPopover();

  expect(result.container.children).toHaveLength(1);
  expect(result.container.firstElementChild?.tagName).toBe("ASIDE");
  result.unmount();
});
