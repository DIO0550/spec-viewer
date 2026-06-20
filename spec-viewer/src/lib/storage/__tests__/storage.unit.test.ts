import { afterEach, expect, test, vi } from "vitest";

import {
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from "@/lib/storage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

test("readStorageValueは保存済みの文字列を読む", () => {
  window.localStorage.setItem("theme", "dark");

  expect(readStorageValue("theme")).toBe("dark");
});

test("readStorageValueは未保存のkeyでnullを返す", () => {
  expect(readStorageValue("missing")).toBeNull();
});

test("writeStorageValueは文字列を書き込む", () => {
  writeStorageValue("theme", "light");

  expect(window.localStorage.getItem("theme")).toBe("light");
});

test("removeStorageValueは文字列を削除する", () => {
  window.localStorage.setItem("theme", "system");

  removeStorageValue("theme");

  expect(window.localStorage.getItem("theme")).toBeNull();
});

test("storageがない環境ではsafe fallbackを返す", () => {
  vi.stubGlobal("window", undefined);

  expect(readStorageValue("theme")).toBeNull();
  expect(() => writeStorageValue("theme", "dark")).not.toThrow();
  expect(() => removeStorageValue("theme")).not.toThrow();
});

test("window.localStorageのproperty access errorを握りつぶす", () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
    throw new Error("blocked");
  });

  expect(readStorageValue("theme")).toBeNull();
  expect(() => writeStorageValue("theme", "dark")).not.toThrow();
  expect(() => removeStorageValue("theme")).not.toThrow();
});

test("storage methodの例外を握りつぶす", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("read failed");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("write failed");
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("remove failed");
  });

  expect(readStorageValue("theme")).toBeNull();
  expect(() => writeStorageValue("theme", "dark")).not.toThrow();
  expect(() => removeStorageValue("theme")).not.toThrow();
});
