import { afterEach, expect, test, vi } from "vitest";

import { readViewportWidth, subscribeViewportWidth } from "@/lib/viewport";

const initialViewportWidth = window.innerWidth;

afterEach(() => {
  vi.unstubAllGlobals();
  window.innerWidth = initialViewportWidth;
});

test("viewportはブラウザの現在幅を読む", () => {
  window.innerWidth = 760;

  expect(readViewportWidth()).toBe(760);
});

test("windowがなければ既定幅を返して購読を行わない", () => {
  const widths: number[] = [];
  vi.stubGlobal("window", undefined);

  expect(readViewportWidth()).toBe(1440);
  const unsubscribe = subscribeViewportWidth((width) => widths.push(width));
  expect(() => unsubscribe()).not.toThrow();
  expect(widths).toEqual([]);
});

test("resize時だけ通知し解除後は通知しない", () => {
  const widths: number[] = [];
  const unsubscribe = subscribeViewportWidth((width) => widths.push(width));

  expect(widths).toEqual([]);
  window.innerWidth = 760;
  window.dispatchEvent(new Event("resize"));
  expect(widths).toEqual([760]);

  unsubscribe();
  window.innerWidth = 600;
  window.dispatchEvent(new Event("resize"));
  expect(widths).toEqual([760]);
});

test("複数の購読を独立して解除し再購読できる", () => {
  const first: number[] = [];
  const second: number[] = [];
  const third: number[] = [];
  const stopFirst = subscribeViewportWidth((width) => first.push(width));
  const stopSecond = subscribeViewportWidth((width) => second.push(width));

  window.innerWidth = 760;
  window.dispatchEvent(new Event("resize"));
  stopFirst();
  window.innerWidth = 600;
  window.dispatchEvent(new Event("resize"));
  stopSecond();

  const stopThird = subscribeViewportWidth((width) => third.push(width));
  window.innerWidth = 1440;
  window.dispatchEvent(new Event("resize"));
  stopThird();

  expect(first).toEqual([760]);
  expect(second).toEqual([760, 600]);
  expect(third).toEqual([1440]);
});
