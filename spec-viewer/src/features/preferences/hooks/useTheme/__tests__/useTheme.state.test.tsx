import { act, type ReactElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { ThemeProvider, useTheme } from "@/features/preferences/hooks/useTheme";

type HookWrapper = (props: Readonly<{ children: ReactNode }>) => ReactElement;

type HookResult<Result> = Readonly<{
  current: Result;
  unmount: () => void;
}>;

type MatchMediaController = Readonly<{
  setMatches: (nextMatches: boolean) => void;
  fireChange: () => void;
  listenerCount: () => number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}>;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.colorScheme = "";
});

function renderHook<Result>(
  hook: () => Result,
  options: Readonly<{ wrapper?: HookWrapper }> = {},
): HookResult<Result> {
  const container = document.createElement("div");
  const root = createRoot(container);
  const result = { current: undefined as Result };

  function TestComponent(): null {
    result.current = hook();
    return null;
  }

  const Wrapper = options.wrapper;

  act(() => {
    root.render(
      Wrapper === undefined ? (
        <TestComponent />
      ) : (
        <Wrapper>
          <TestComponent />
        </Wrapper>
      ),
    );
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

function resetThemeEnvironment(prefersDark: boolean): MatchMediaController {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.colorScheme = "";

  return stubMatchMedia(prefersDark);
}

function stubMatchMedia(prefersDark: boolean): MatchMediaController {
  let matches = prefersDark;
  const listeners = new Set<() => void>();
  const addEventListener = vi.fn(
    (_eventName: "change", listener: () => void): void => {
      listeners.add(listener);
    },
  );
  const removeEventListener = vi.fn(
    (_eventName: "change", listener: () => void): void => {
      listeners.delete(listener);
    },
  );

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(
      (media: string): MediaQueryList =>
        ({
          get matches() {
            return matches;
          },
          media,
          onchange: null,
          addEventListener,
          removeEventListener,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    ),
  );

  return {
    setMatches(nextMatches: boolean): void {
      matches = nextMatches;
    },
    fireChange(): void {
      listeners.forEach((listener) => {
        listener();
      });
    },
    listenerCount(): number {
      return listeners.size;
    },
    addEventListener,
    removeEventListener,
  };
}

test("useThemeはsystemを初期値にしてOSのdarkを反映する", () => {
  resetThemeEnvironment(true);

  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  expect(result.current.themeMode).toBe("system");
  expect(result.current.resolvedTheme).toBe("dark");
  expect(window.localStorage.getItem("spec-reviewer.theme-mode")).toBe(
    "system",
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeMode).toBe("system");
  expect(document.documentElement.style.colorScheme).toBe("dark");
  result.unmount();
});

test("useThemeは選択したlight preferenceを同じact cycleで保存してdocumentへ反映する", () => {
  resetThemeEnvironment(true);
  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  act(() => {
    result.current.setThemeMode("light");
  });

  expect(result.current.themeMode).toBe("light");
  expect(result.current.resolvedTheme).toBe("light");
  expect(window.localStorage.getItem("spec-reviewer.theme-mode")).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(document.documentElement.dataset.themeMode).toBe("light");
  expect(document.documentElement.style.colorScheme).toBe("light");
  result.unmount();
});

test("useThemeは保存済みdark preferenceを初期値にする", () => {
  resetThemeEnvironment(false);
  window.localStorage.setItem("spec-reviewer.theme-mode", "dark");

  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  expect(result.current.themeMode).toBe("dark");
  expect(result.current.resolvedTheme).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeMode).toBe("dark");
  result.unmount();
});

test("useThemeは無効な保存値をsystemへfallbackする", () => {
  resetThemeEnvironment(false);
  window.localStorage.setItem("spec-reviewer.theme-mode", "blue");

  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  expect(result.current.themeMode).toBe("system");
  expect(result.current.resolvedTheme).toBe("light");
  expect(window.localStorage.getItem("spec-reviewer.theme-mode")).toBe(
    "system",
  );
  result.unmount();
});

test("useThemeはstorage read error時にsystemへfallbackする", () => {
  resetThemeEnvironment(true);
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked");
  });

  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  expect(result.current.themeMode).toBe("system");
  expect(result.current.resolvedTheme).toBe("dark");
  result.unmount();
});

test("useThemeはstorage write errorでもtheme更新を継続する", () => {
  resetThemeEnvironment(false);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("write failed");
  });
  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  act(() => {
    result.current.setThemeMode("dark");
  });

  expect(result.current.themeMode).toBe("dark");
  expect(result.current.resolvedTheme).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  result.unmount();
});

test("useThemeはsystem modeでmatchMedia change eventを反映する", () => {
  const matchMediaController = resetThemeEnvironment(false);
  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  act(() => {
    matchMediaController.setMatches(true);
    matchMediaController.fireChange();
  });

  expect(result.current.themeMode).toBe("system");
  expect(result.current.resolvedTheme).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.themeMode).toBe("system");
  result.unmount();
});

test("useThemeは明示light modeでsystem theme変更を無視する", () => {
  const matchMediaController = resetThemeEnvironment(false);
  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  act(() => {
    result.current.setThemeMode("light");
  });
  act(() => {
    matchMediaController.setMatches(true);
    matchMediaController.fireChange();
  });

  expect(result.current.themeMode).toBe("light");
  expect(result.current.resolvedTheme).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
  result.unmount();
});

test("useThemeはunmount時にsystem theme listenerを解除する", () => {
  const matchMediaController = resetThemeEnvironment(false);
  const result = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  result.unmount();

  expect(matchMediaController.addEventListener).toHaveBeenCalledTimes(1);
  expect(matchMediaController.removeEventListener).toHaveBeenCalledTimes(1);
  expect(matchMediaController.removeEventListener).toHaveBeenCalledWith(
    "change",
    matchMediaController.addEventListener.mock.calls[0]?.[1],
  );
  expect(matchMediaController.listenerCount()).toBe(0);
});

test("useThemeはThemeProvider外で呼ぶと例外を投げる", () => {
  resetThemeEnvironment(false);

  expect(() => {
    renderHook(() => useTheme());
  }).toThrow("ThemeProvider is missing");
});

test("useThemeは同じThemeProvider配下のconsumerでtheme stateを共有する", () => {
  resetThemeEnvironment(false);
  let firstValue: ReturnType<typeof useTheme> | null = null;
  let secondValue: ReturnType<typeof useTheme> | null = null;

  function FirstConsumer(): null {
    firstValue = useTheme();
    return null;
  }

  function SecondConsumer(): null {
    secondValue = useTheme();
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(
      <ThemeProvider>
        <FirstConsumer />
        <SecondConsumer />
      </ThemeProvider>,
    );
  });
  act(() => {
    firstValue!.setThemeMode("dark");
  });

  expect(firstValue!.themeMode).toBe("dark");
  expect(secondValue!.themeMode).toBe("dark");
  expect(secondValue!.resolvedTheme).toBe("dark");
  act(() => {
    root.unmount();
  });
});

test("useThemeは複数consumerでもmatchMedia listenerを1つだけ登録する", () => {
  const matchMediaController = resetThemeEnvironment(false);

  function FirstConsumer(): null {
    useTheme();
    return null;
  }

  function SecondConsumer(): null {
    useTheme();
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);

  act(() => {
    root.render(
      <ThemeProvider>
        <FirstConsumer />
        <SecondConsumer />
      </ThemeProvider>,
    );
  });

  expect(matchMediaController.addEventListener).toHaveBeenCalledTimes(1);
  expect(matchMediaController.listenerCount()).toBe(1);
  act(() => {
    root.unmount();
  });
});

test("useThemeはunmountとremountで重複listenerを残さない", () => {
  const matchMediaController = resetThemeEnvironment(false);
  const firstResult = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  firstResult.unmount();
  const secondResult = renderHook(() => useTheme(), { wrapper: ThemeProvider });

  expect(matchMediaController.listenerCount()).toBe(1);
  act(() => {
    matchMediaController.setMatches(true);
    matchMediaController.fireChange();
  });
  expect(secondResult.current.resolvedTheme).toBe("dark");
  secondResult.unmount();
});
