import { act } from "react";
import { createRoot } from "react-dom/client";
import { onTestFinished } from "vitest";

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

/**
 * @param hook - Hook evaluated inside a mounted React component.
 * @returns Latest result and an explicit unmount operation.
 */
export function renderHook<Result>(hook: () => Result): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  /** @returns No markup; this component evaluates the hook for the test. */
  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  onTestFinished(() => {
    act(() => root.unmount());
  });

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return result.current;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}
