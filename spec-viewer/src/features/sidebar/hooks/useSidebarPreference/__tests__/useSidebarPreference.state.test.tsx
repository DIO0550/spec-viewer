import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import {
  SidebarPreferenceProvider,
  useSidebarPreference,
  type SidebarPreferenceContextValue,
} from "@/features/sidebar";

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

type RenderHookOptions = Readonly<{
  wrapper?: (props: Readonly<{ children: ReactNode }>) => ReactNode;
}>;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderHook<Result>(
  hook: () => Result,
  options: RenderHookOptions = {},
): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };
  const wrapper = options.wrapper ?? ((props) => props.children);

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  act(() => {
    root.render(wrapper({ children: <TestComponent /> }));
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

/** @returns Sidebar preference hook wrapped with its Provider. */
function renderSidebarPreferenceHook(): HookResult<SidebarPreferenceContextValue> {
  return renderHook(() => useSidebarPreference(), {
    wrapper: (props) => (
      <SidebarPreferenceProvider>{props.children}</SidebarPreferenceProvider>
    ),
  });
}

test("SidebarPreferenceProvider配下では初期状態でサイドバーを開く", () => {
  const result = renderSidebarPreferenceHook();

  expect(result.current.isSidebarOpen).toBe(true);
  result.unmount();
});

test("useSidebarPreferenceはProvider外で使うと例外を投げる", () => {
  expect(() => renderHook(() => useSidebarPreference())).toThrow(
    "SidebarPreferenceProvider is missing",
  );
});

test("useSidebarPreferenceは閉じた保存状態を既存keyから復元する", () => {
  window.localStorage.setItem("spec-reviewer.comment-sidebar-open", "false");

  const result = renderSidebarPreferenceHook();

  expect(result.current.isSidebarOpen).toBe(false);
  result.unmount();
});

test("closeSidebarは状態を閉じて既存keyにfalseを保存する", () => {
  const result = renderSidebarPreferenceHook();

  act(() => {
    result.current.closeSidebar();
  });

  expect(result.current.isSidebarOpen).toBe(false);
  expect(
    window.localStorage.getItem("spec-reviewer.comment-sidebar-open"),
  ).toBe("false");
  result.unmount();
});

test("openSidebarは状態を開いて既存keyにtrueを保存する", () => {
  window.localStorage.setItem("spec-reviewer.comment-sidebar-open", "false");
  const result = renderSidebarPreferenceHook();

  act(() => {
    result.current.openSidebar();
  });

  expect(result.current.isSidebarOpen).toBe(true);
  expect(
    window.localStorage.getItem("spec-reviewer.comment-sidebar-open"),
  ).toBe("true");
  result.unmount();
});

test("storage readが失敗してもopen fallbackになる", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read failed");
  });

  const result = renderSidebarPreferenceHook();

  expect(result.current.isSidebarOpen).toBe(true);
  result.unmount();
});

test("storage writeが失敗してもUI状態は更新される", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("write failed");
  });
  const result = renderSidebarPreferenceHook();

  act(() => {
    result.current.closeSidebar();
  });

  expect(result.current.isSidebarOpen).toBe(false);
  result.unmount();
});

test("同一Provider配下の複数consumerは開閉状態を共有する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const first = {
    current: undefined as SidebarPreferenceContextValue | undefined,
  };
  const second = {
    current: undefined as SidebarPreferenceContextValue | undefined,
  };

  function FirstConsumer(): null {
    first.current = useSidebarPreference();
    return null;
  }

  function SecondConsumer(): null {
    second.current = useSidebarPreference();
    return null;
  }

  act(() => {
    root.render(
      <SidebarPreferenceProvider>
        <FirstConsumer />
        <SecondConsumer />
      </SidebarPreferenceProvider>,
    );
  });
  act(() => {
    first.current!.closeSidebar();
  });

  expect(first.current!.isSidebarOpen).toBe(false);
  expect(second.current!.isSidebarOpen).toBe(false);

  act(() => {
    second.current!.openSidebar();
  });

  expect(first.current!.isSidebarOpen).toBe(true);
  expect(second.current!.isSidebarOpen).toBe(true);

  act(() => {
    root.unmount();
  });
});

test("状態が変わらない再renderではcallbackとContext valueの参照が安定する", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const captured = {
    current: undefined as SidebarPreferenceContextValue | undefined,
  };
  const forceRender = { current: () => {} };

  function Consumer(): null {
    captured.current = useSidebarPreference();
    return null;
  }

  function Host(): ReactNode {
    const [, setVersion] = useState(0);
    forceRender.current = () => {
      setVersion((version) => version + 1);
    };

    return (
      <SidebarPreferenceProvider>
        <Consumer />
      </SidebarPreferenceProvider>
    );
  }

  act(() => {
    root.render(<Host />);
  });
  const firstValue = captured.current;
  const firstOpenSidebar = captured.current!.openSidebar;
  const firstCloseSidebar = captured.current!.closeSidebar;

  act(() => {
    forceRender.current();
  });

  expect(captured.current).toBe(firstValue);
  expect(captured.current!.openSidebar).toBe(firstOpenSidebar);
  expect(captured.current!.closeSidebar).toBe(firstCloseSidebar);

  act(() => {
    root.unmount();
  });
});
