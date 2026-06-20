import { afterEach, expect, test, vi } from "vitest";

import {
  canUseSystemThemeApi,
  getSystemTheme,
  subscribeSystemTheme,
} from "@/lib/systemTheme";

type MediaQueryStub = Readonly<{
  setMatches: (nextMatches: boolean) => void;
  fireChange: () => void;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  listenerCount: () => number;
}>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubMatchMedia(matches: boolean): MediaQueryStub {
  let currentMatches = matches;
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
            return currentMatches;
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
      currentMatches = nextMatches;
    },
    fireChange(): void {
      listeners.forEach((listener) => {
        listener();
      });
    },
    addEventListener,
    removeEventListener,
    listenerCount(): number {
      return listeners.size;
    },
  };
}

test("canUseSystemThemeApiはmatchMedia未提供ならfalseを返す", () => {
  vi.stubGlobal("matchMedia", undefined);

  expect(canUseSystemThemeApi()).toBe(false);
  expect(getSystemTheme()).toBe("light");
});

test.each([
  { matches: true, expected: "dark" },
  { matches: false, expected: "light" },
] as const)("getSystemThemeはmedia query結果をappearanceへ変換する", ({
  matches,
  expected,
}) => {
  stubMatchMedia(matches);

  expect(canUseSystemThemeApi()).toBe(true);
  expect(getSystemTheme()).toBe(expected);
});

test("subscribeSystemThemeは購読直後にcallbackを呼ばない", () => {
  stubMatchMedia(false);
  const onChange = vi.fn();

  subscribeSystemTheme(onChange);

  expect(onChange).not.toHaveBeenCalled();
});

test("subscribeSystemThemeはchange eventで現在のappearanceを通知する", () => {
  const mediaQueryStub = stubMatchMedia(false);
  const onChange = vi.fn();

  subscribeSystemTheme(onChange);
  mediaQueryStub.setMatches(true);
  mediaQueryStub.fireChange();

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith("dark");
});

test("subscribeSystemThemeのcleanupは同じlistener参照を解除する", () => {
  const mediaQueryStub = stubMatchMedia(false);
  const unsubscribe = subscribeSystemTheme(vi.fn());

  unsubscribe();

  expect(mediaQueryStub.addEventListener).toHaveBeenCalledTimes(1);
  expect(mediaQueryStub.removeEventListener).toHaveBeenCalledTimes(1);
  expect(mediaQueryStub.removeEventListener).toHaveBeenCalledWith(
    "change",
    mediaQueryStub.addEventListener.mock.calls[0]?.[1],
  );
});

test("subscribeSystemThemeは解除後のchange eventを通知しない", () => {
  const mediaQueryStub = stubMatchMedia(false);
  const onChange = vi.fn();
  const unsubscribe = subscribeSystemTheme(onChange);

  unsubscribe();
  mediaQueryStub.setMatches(true);
  mediaQueryStub.fireChange();

  expect(onChange).not.toHaveBeenCalled();
  expect(mediaQueryStub.listenerCount()).toBe(0);
});
