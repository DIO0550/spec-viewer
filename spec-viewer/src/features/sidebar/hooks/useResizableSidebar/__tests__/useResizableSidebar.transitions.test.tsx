import { act } from "react";
import { afterEach, beforeEach, expect, test } from "vitest";

import { useResizableSidebar } from "@/features/sidebar";

import { renderHook } from "./renderHook";

const StorageKey = "spec-reviewer.comment-sidebar-width";
const initialViewportWidth = window.innerWidth;

beforeEach(() => {
  window.localStorage.clear();
  window.innerWidth = 1440;
});

afterEach(() => {
  window.localStorage.clear();
  window.innerWidth = initialViewportWidth;
});

test("同じ更新内の相対変更を失わず上下限で保存する", () => {
  const result = renderHook(useResizableSidebar);

  act(() => {
    result.current.resizeSidebarBy(20);
    result.current.resizeSidebarBy(30);
  });
  expect(result.current.sidebarWidth).toBe(350);

  act(() => result.current.resizeSidebarBy(1000));
  expect(result.current.sidebarWidth).toBe(560);
  act(() => result.current.resizeSidebarBy(-1000));
  expect(result.current.sidebarWidth).toBe(280);
  expect(window.localStorage.getItem(StorageKey)).toBe("280");
});

test.each([
  [1440, 300],
  [600, 280],
])("画面幅%iでリセットすると%iを保存する", (viewport, expected) => {
  window.innerWidth = viewport;
  const result = renderHook(useResizableSidebar);

  act(() => result.current.resizeSidebarTo(500));
  act(() => result.current.resetSidebarWidth());

  expect(result.current.sidebarWidth).toBe(expected);
  expect(window.localStorage.getItem(StorageKey)).toBe(String(expected));
});

test("画面縮小で現在幅を補正し拡大時はその幅を維持する", () => {
  const result = renderHook(useResizableSidebar);
  act(() => result.current.resizeSidebarTo(500));

  act(() => {
    window.innerWidth = 760;
    window.dispatchEvent(new Event("resize"));
  });
  expect(result.current.sidebarWidth).toBe(342);

  act(() => {
    window.innerWidth = 1440;
    window.dispatchEvent(new Event("resize"));
  });
  expect(result.current.sidebarWidth).toBe(342);
  expect(window.localStorage.getItem(StorageKey)).toBe("342");
});

test("画面変更後の相対操作は新しい上限を使用する", () => {
  const result = renderHook(useResizableSidebar);
  act(() => result.current.resizeSidebarTo(500));
  act(() => {
    window.innerWidth = 760;
    window.dispatchEvent(new Event("resize"));
  });
  act(() => result.current.resizeSidebarBy(100));

  expect(result.current.sidebarWidth).toBe(342);
});

test("相対操作後の画面変更も現在幅を補正する", () => {
  const result = renderHook(useResizableSidebar);
  act(() => {
    result.current.resizeSidebarTo(500);
    result.current.resizeSidebarBy(100);
  });
  act(() => {
    window.innerWidth = 760;
    window.dispatchEvent(new Event("resize"));
  });

  expect(result.current.sidebarWidth).toBe(342);
});

test("狭い画面での非有限な絶対指定は従来通り300を保存する", () => {
  window.innerWidth = 600;
  const result = renderHook(useResizableSidebar);

  act(() => result.current.resizeSidebarTo(NaN));

  expect(result.current.sidebarWidth).toBe(300);
  expect(window.localStorage.getItem(StorageKey)).toBe("300");
});

test("狭い画面での非有限な相対指定は従来通り300を保存する", () => {
  window.innerWidth = 600;
  const result = renderHook(useResizableSidebar);

  act(() => result.current.resizeSidebarBy(Infinity));

  expect(result.current.sidebarWidth).toBe(300);
  expect(window.localStorage.getItem(StorageKey)).toBe("300");
});
