import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { useResizableSidebar } from "@/features/sidebar";

import { renderHook } from "./renderHook";

const StorageKey = "spec-reviewer.comment-sidebar-width";
const initialViewportWidth = window.innerWidth;

beforeEach(() => {
  window.localStorage.clear();
  window.innerWidth = 1440;
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.innerWidth = initialViewportWidth;
});

test("狭い画面で未保存の幅は初期300から補正した280の順に保存する", () => {
  window.innerWidth = 600;
  const setItem = vi.spyOn(Storage.prototype, "setItem");
  const result = renderHook(useResizableSidebar);

  expect(result.current.sidebarWidth).toBe(280);
  expect(setItem.mock.calls).toEqual([
    [StorageKey, "300"],
    [StorageKey, "280"],
  ]);
  expect(window.localStorage.getItem(StorageKey)).toBe("280");
});

test("狭い画面で不正な保存値から既定幅を再補正する", () => {
  window.innerWidth = 600;
  window.localStorage.setItem(StorageKey, "abc");
  const result = renderHook(useResizableSidebar);

  expect(result.current.sidebarWidth).toBe(280);
  expect(window.localStorage.getItem(StorageKey)).toBe("280");
});

test("保存媒体の読取が失敗しても既定幅から操作できる", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read failed");
  });
  const result = renderHook(useResizableSidebar);
  expect(result.current.sidebarWidth).toBe(300);

  act(() => result.current.resizeSidebarTo(320));
  expect(result.current.sidebarWidth).toBe(320);
});

test("保存媒体の書込が失敗しても表示幅を更新できる", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("write failed");
  });
  const result = renderHook(useResizableSidebar);

  act(() => result.current.resizeSidebarTo(320));
  expect(result.current.sidebarWidth).toBe(320);
});

test("再マウントで保存幅を復元し最新画面幅に追従する", () => {
  const first = renderHook(useResizableSidebar);
  act(() => first.current.resizeSidebarTo(500));
  first.unmount();
  act(() => {
    window.innerWidth = 760;
    window.dispatchEvent(new Event("resize"));
  });
  expect(first.current.sidebarWidth).toBe(500);

  const second = renderHook(useResizableSidebar);
  expect(second.current.sidebarWidth).toBe(342);
  act(() => {
    window.innerWidth = 600;
    window.dispatchEvent(new Event("resize"));
  });
  expect(second.current.sidebarWidth).toBe(280);
  expect(window.localStorage.getItem(StorageKey)).toBe("280");
});
