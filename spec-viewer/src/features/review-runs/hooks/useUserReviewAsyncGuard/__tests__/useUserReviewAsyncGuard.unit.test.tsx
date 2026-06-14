import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { useUserReviewAsyncGuard } from "@/features/review-runs/hooks/useUserReviewAsyncGuard";

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

function renderHook<Result>(hook: () => Result): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

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
      container.remove();
    },
  };
}

test("useUserReviewAsyncGuardはrequest idとtarget identityが一致するとcurrentと判定する", () => {
  const result = renderHook(() => useUserReviewAsyncGuard());

  const request = result.current.begin("file:auth:tasks");

  expect(result.current.isCurrent(request)).toBe(true);
  result.unmount();
});

test("useUserReviewAsyncGuardはtarget identityが変わると古いrequestをcurrentにしない", () => {
  const result = renderHook(() => useUserReviewAsyncGuard());

  const request = result.current.begin("file:auth:tasks");
  result.current.setCurrentIdentity("file:billing:tasks");

  expect(result.current.isCurrent(request)).toBe(false);
  result.unmount();
});

test("useUserReviewAsyncGuardはinvalidate後の古いrequestをcurrentにしない", () => {
  const result = renderHook(() => useUserReviewAsyncGuard());

  const request = result.current.begin("file:auth:tasks");
  result.current.invalidate();

  expect(result.current.isCurrent(request)).toBe(false);
  result.unmount();
});
