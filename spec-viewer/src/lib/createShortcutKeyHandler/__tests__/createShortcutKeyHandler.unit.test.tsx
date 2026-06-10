import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import {
  createShortcutKeyHandler,
  type ShortcutModifier,
} from "@/lib/createShortcutKeyHandler";

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

type ShortcutHarnessProps = Readonly<{
  onMatch: () => void;
  alternateMatch?: () => void;
  shortcutKey?: string;
  eventKey?: string;
  modifiers?: readonly ShortcutModifier[];
  allowsAdditionalModifiers?: boolean;
  isEnabled?: boolean;
  preventDefault?: boolean;
  respectDefaultPrevented?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isDefaultPreventedBeforeDispatch?: boolean;
}>;

function ShortcutHarness({
  onMatch,
  alternateMatch = vi.fn(),
  shortcutKey = "Enter",
  eventKey = "Enter",
  modifiers,
  allowsAdditionalModifiers,
  isEnabled,
  preventDefault,
  respectDefaultPrevented,
  ctrlKey = false,
  metaKey = false,
  altKey = false,
  shiftKey = false,
  isDefaultPreventedBeforeDispatch = false,
}: ShortcutHarnessProps) {
  const handleKeyDown = createShortcutKeyHandler<HTMLButtonElement>({
    shortcuts: [
      {
        key: shortcutKey,
        modifiers,
        allowsAdditionalModifiers,
        isEnabled,
        preventDefault,
        respectDefaultPrevented,
        onMatch,
      },
      {
        key: shortcutKey,
        onMatch: alternateMatch,
      },
    ],
  });

  return (
    <button
      type="button"
      onKeyDown={handleKeyDown}
      data-event-key={eventKey}
      data-ctrl-key={String(ctrlKey)}
      data-meta-key={String(metaKey)}
      data-alt-key={String(altKey)}
      data-shift-key={String(shiftKey)}
      data-default-prevented={String(isDefaultPreventedBeforeDispatch)}
    >
      Dispatch shortcut
    </button>
  );
}

function dispatchHarnessKeyDown(container: ParentNode): KeyboardEvent {
  const button = container.querySelector("button") as HTMLButtonElement;
  const event = new KeyboardEvent("keydown", {
    key: button.dataset.eventKey,
    ctrlKey: button.dataset.ctrlKey === "true",
    metaKey: button.dataset.metaKey === "true",
    altKey: button.dataset.altKey === "true",
    shiftKey: button.dataset.shiftKey === "true",
    bubbles: true,
    cancelable: true,
  });

  void (button.dataset.defaultPrevented === "true" && event.preventDefault());

  act(() => {
    button.dispatchEvent(event);
  });

  return event;
}

test("createShortcutKeyHandlerはkeyが一致したbindingのonMatchを呼ぶ", () => {
  const onMatch = vi.fn();
  const result = renderComponent(<ShortcutHarness onMatch={onMatch} />);

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).toHaveBeenCalledOnce();
  result.unmount();
});

test("createShortcutKeyHandlerはkeyが一致しないbindingのonMatchを呼ばない", () => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness onMatch={onMatch} eventKey="Escape" />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).not.toHaveBeenCalled();
  result.unmount();
});

test.each([
  ["Ctrl+Enter", true, false],
  ["Meta+Enter", false, true],
] as const)("createShortcutKeyHandlerはctrlOrMeta modifierで%sに一致する", (_label, ctrlKey, metaKey) => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onMatch={onMatch}
      modifiers={["ctrlOrMeta"]}
      ctrlKey={ctrlKey}
      metaKey={metaKey}
    />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).toHaveBeenCalledOnce();
  result.unmount();
});

test.each([
  ["Shift+Ctrl+Enter", true, false, false, true],
  ["Alt+Meta+Enter", false, true, true, false],
] as const)("createShortcutKeyHandlerはctrlOrMeta modifierで余分な%sに一致しない", (_label, ctrlKey, metaKey, altKey, shiftKey) => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onMatch={onMatch}
      modifiers={["ctrlOrMeta"]}
      ctrlKey={ctrlKey}
      metaKey={metaKey}
      altKey={altKey}
      shiftKey={shiftKey}
    />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).not.toHaveBeenCalled();
  result.unmount();
});

test("createShortcutKeyHandlerはallowsAdditionalModifiers=trueなら余分なmodifierを許容する", () => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onMatch={onMatch}
      modifiers={["ctrlOrMeta"]}
      allowsAdditionalModifiers={true}
      ctrlKey={true}
      shiftKey={true}
    />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).toHaveBeenCalledOnce();
  result.unmount();
});

test("createShortcutKeyHandlerはisEnabled=falseのbindingを実行しない", () => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness onMatch={onMatch} isEnabled={false} />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).not.toHaveBeenCalled();
  result.unmount();
});

test("createShortcutKeyHandlerはpreventDefault=trueでevent.preventDefaultを呼ぶ", () => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness onMatch={onMatch} preventDefault={true} />,
  );

  const event = dispatchHarnessKeyDown(result.container);

  expect(event.defaultPrevented).toBe(true);
  expect(onMatch).toHaveBeenCalledOnce();
  result.unmount();
});

test("createShortcutKeyHandlerはdefaultPreventedのkeydownを既定では無視する", () => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onMatch={onMatch}
      isDefaultPreventedBeforeDispatch={true}
    />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).not.toHaveBeenCalled();
  result.unmount();
});

test("createShortcutKeyHandlerはrespectDefaultPrevented=falseならdefaultPrevented後も処理する", () => {
  const onMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness
      onMatch={onMatch}
      respectDefaultPrevented={false}
      isDefaultPreventedBeforeDispatch={true}
    />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).toHaveBeenCalledOnce();
  result.unmount();
});

test("createShortcutKeyHandlerは複数bindingが一致したとき最初の一致だけ実行する", () => {
  const onMatch = vi.fn();
  const alternateMatch = vi.fn();
  const result = renderComponent(
    <ShortcutHarness onMatch={onMatch} alternateMatch={alternateMatch} />,
  );

  dispatchHarnessKeyDown(result.container);

  expect(onMatch).toHaveBeenCalledOnce();
  expect(alternateMatch).not.toHaveBeenCalled();
  result.unmount();
});
