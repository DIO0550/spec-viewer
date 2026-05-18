import { act, useRef } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { useOutsideMouseDown } from "@/features/comments/hooks/useOutsideMouseDown";

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

type OutsideMouseDownHarnessProps = Readonly<{
  onOutsideMouseDown: () => void;
  isEnabled?: boolean;
  isLayerRendered?: boolean;
}>;

function OutsideMouseDownHarness({
  onOutsideMouseDown,
  isEnabled = true,
  isLayerRendered = true,
}: OutsideMouseDownHarnessProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useOutsideMouseDown({
    layerRef,
    isEnabled,
    onOutsideMouseDown,
  });

  return (
    <section>
      {isLayerRendered ? (
        <div ref={layerRef} data-testid="layer">
          Popover content
        </div>
      ) : null}
      <button type="button">External target</button>
    </section>
  );
}

function dispatchDocumentMouseDown(): void {
  act(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

function dispatchInternalMouseDown(container: ParentNode): void {
  const layer = container.querySelector("[data-testid='layer']") as HTMLElement;

  act(() => {
    layer.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  });
}

test("useOutsideMouseDownは外部mousedownでcallbackを呼ぶ", () => {
  const onOutsideMouseDown = vi.fn();
  const result = renderComponent(
    <OutsideMouseDownHarness onOutsideMouseDown={onOutsideMouseDown} />,
  );

  dispatchDocumentMouseDown();

  expect(onOutsideMouseDown).toHaveBeenCalledOnce();
  result.unmount();
});

test("useOutsideMouseDownは内部mousedownではcallbackを呼ばない", () => {
  const onOutsideMouseDown = vi.fn();
  const result = renderComponent(
    <OutsideMouseDownHarness onOutsideMouseDown={onOutsideMouseDown} />,
  );

  dispatchInternalMouseDown(result.container);

  expect(onOutsideMouseDown).not.toHaveBeenCalled();
  result.unmount();
});

test("useOutsideMouseDownはisEnabled=falseでは外部mousedownを無視する", () => {
  const onOutsideMouseDown = vi.fn();
  const result = renderComponent(
    <OutsideMouseDownHarness
      onOutsideMouseDown={onOutsideMouseDown}
      isEnabled={false}
    />,
  );

  dispatchDocumentMouseDown();

  expect(onOutsideMouseDown).not.toHaveBeenCalled();
  result.unmount();
});

test("useOutsideMouseDownはref.currentがnullなら外部mousedownを無視する", () => {
  const onOutsideMouseDown = vi.fn();
  const result = renderComponent(
    <OutsideMouseDownHarness
      onOutsideMouseDown={onOutsideMouseDown}
      isLayerRendered={false}
    />,
  );

  dispatchDocumentMouseDown();

  expect(onOutsideMouseDown).not.toHaveBeenCalled();
  result.unmount();
});

test("useOutsideMouseDownはisEnabled=falseではlistenerを登録しない", () => {
  const onOutsideMouseDown = vi.fn();
  const addEventListener = vi.spyOn(document, "addEventListener");
  const result = renderComponent(
    <OutsideMouseDownHarness
      onOutsideMouseDown={onOutsideMouseDown}
      isEnabled={false}
    />,
  );

  expect(addEventListener).not.toHaveBeenCalledWith(
    "mousedown",
    expect.any(Function),
  );
  dispatchDocumentMouseDown();
  expect(onOutsideMouseDown).not.toHaveBeenCalled();
  addEventListener.mockRestore();
  result.unmount();
});

test("useOutsideMouseDownはtargetがNodeでなければcallbackを呼ばない", () => {
  const listeners: EventListener[] = [];
  const addEventListener = vi
    .spyOn(document, "addEventListener")
    .mockImplementation((_type, listener) => {
      listeners.push(listener as EventListener);
    });
  const removeEventListener = vi
    .spyOn(document, "removeEventListener")
    .mockImplementation(() => undefined);
  const onOutsideMouseDown = vi.fn();
  const result = renderComponent(
    <OutsideMouseDownHarness onOutsideMouseDown={onOutsideMouseDown} />,
  );
  const mouseEvent = { target: "not-a-node" } as unknown as MouseEvent;

  act(() => {
    listeners[0](mouseEvent);
  });

  expect(onOutsideMouseDown).not.toHaveBeenCalled();
  addEventListener.mockRestore();
  removeEventListener.mockRestore();
  result.unmount();
});

test("useOutsideMouseDownはunmount後のdocument eventでcallbackを呼ばない", () => {
  const onOutsideMouseDown = vi.fn();
  const result = renderComponent(
    <OutsideMouseDownHarness onOutsideMouseDown={onOutsideMouseDown} />,
  );

  result.unmount();
  dispatchDocumentMouseDown();

  expect(onOutsideMouseDown).not.toHaveBeenCalled();
});
