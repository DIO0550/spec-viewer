import { afterEach, expect, test, vi } from "vitest";

import {
  readStoredSidebarWidth,
  writeStoredSidebarWidth,
} from "@/lib/storage/sidebar";

const StorageKey = "spec-reviewer.comment-sidebar-width";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

test.each([
  ["320", 320],
  ["320.9", 320],
  ["320px", 320],
  [" 320 ", 320],
  ["0", 0],
  ["-1", -1],
])("保存値%sを補正前の候補%sとして読む", (stored, expected) => {
  window.localStorage.setItem(StorageKey, stored);

  expect(readStoredSidebarWidth()).toBe(expected);
});

test("未保存の候補はNaNを返す", () => {
  expect(readStoredSidebarWidth()).toBeNaN();
});

test.each([
  "",
  "abc",
  "Infinity",
])("保存値%sが整数でなければNaNを返す", (stored) => {
  window.localStorage.setItem(StorageKey, stored);

  expect(readStoredSidebarWidth()).toBeNaN();
});

test("幅を既存キーへ文字列で保存し他の設定を維持する", () => {
  window.localStorage.setItem("theme", "dark");

  writeStoredSidebarWidth(342);

  expect(window.localStorage.getItem(StorageKey)).toBe("342");
  expect(readStoredSidebarWidth()).toBe(342);
  expect(window.localStorage.getItem("theme")).toBe("dark");
});

test("windowがなければ候補はNaNで書込も失敗しない", () => {
  vi.stubGlobal("window", undefined);

  expect(readStoredSidebarWidth()).toBeNaN();
  expect(() => writeStoredSidebarWidth(320)).not.toThrow();
});

test("localStorageの取得が拒否されても候補はNaNで書込も失敗しない", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked");
  });

  expect(readStoredSidebarWidth()).toBeNaN();
  expect(() => writeStoredSidebarWidth(320)).not.toThrow();
});

test("保存媒体の読取失敗はNaNへ変換する", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read failed");
  });

  expect(readStoredSidebarWidth()).toBeNaN();
});

test("保存媒体の書込失敗を呼出元へ伝播しない", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("write failed");
  });

  expect(() => writeStoredSidebarWidth(320)).not.toThrow();
});
