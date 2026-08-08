import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

/**
 * The hook under test, as invoked by the harness on every render.
 *
 * @param props - Props for the current render.
 * @returns The hook's return value for this render.
 */
export type HookUnderTest<Props, Result> = (props: Props) => Result;

export type RenderHookResult<Props, Result> = Readonly<{
  /** @returns The value returned by the most recent hook render. */
  current: () => Result;
  /**
   * Re-renders the hook with new props.
   *
   * @param next - Props for the next render.
   */
  rerender: (next: Props) => void;
  /** Unmounts the host component so cleanup effects run. */
  unmount: () => void;
}>;

/**
 * Renders a hook inside a throwaway React root so tests can observe its
 * return value across re-renders and unmount.
 *
 * @param useHook - The hook to render, invoked with the current props.
 * @param initialProps - Props for the first render.
 * @returns Accessors for the current result, plus rerender and unmount.
 */
export function renderHook<Props, Result>(
  useHook: HookUnderTest<Props, Result>,
  initialProps: Props,
): RenderHookResult<Props, Result> {
  const root = createRoot(document.createElement("div"));
  const result = { current: undefined as unknown as Result };

  /**
   * Host component that calls the hook under test and records its result.
   *
   * @param props - Wrapper carrying the props passed to the hook.
   * @returns Null; the component renders nothing.
   */
  function TestComponent(props: Readonly<{ hookProps: Props }>): null {
    result.current = useHook(props.hookProps);
    return null;
  }

  /**
   * Renders the host component with the given props inside `act`.
   *
   * @param props - Props to pass to the hook for this render.
   */
  function render(props: Props): void {
    act(() => root.render(createElement(TestComponent, { hookProps: props })));
  }

  /** @returns The value returned by the most recent hook render. */
  function current(): Result {
    return result.current;
  }

  /** Unmounts the host component so cleanup effects run. */
  function unmount(): void {
    act(() => root.unmount());
  }

  render(initialProps);

  return { current, rerender: render, unmount };
}

export type Deferred<T> = Readonly<{
  promise: Promise<T>;
  /**
   * Settles the deferred promise.
   *
   * @param value - The resolved value.
   */
  resolve: (value: T) => void;
  /**
   * Rejects the deferred promise.
   *
   * @param reason - The rejection reason.
   */
  reject: (reason: unknown) => void;
}>;

/**
 * Creates a promise whose settlement the test controls, so request ordering
 * can be driven deterministically.
 *
 * @returns The pending promise and its resolve and reject handles.
 */
export function createDeferred<T>(): Deferred<T> {
  let resolveValue: (value: T) => void = () => undefined;
  let rejectValue: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolveValue = resolve;
    rejectValue = reject;
  });

  return { promise, resolve: resolveValue, reject: rejectValue };
}

/**
 * Flushes pending microtasks and timers inside `act` so state updates from
 * settled promises are applied before assertions run.
 *
 * @param delayMs - How long to wait, for state updates gated on a timer.
 * @returns A promise that settles once React has processed the updates.
 */
export async function flush(delayMs = 0): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  });
}
