import { afterEach, expect, test, vi } from "vitest";

import { copyTextToClipboard } from "@/lib/clipboard";

const originalClipboard: unknown = navigator.clipboard;

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setClipboard(originalClipboard);
});

test("copyTextToClipboardは利用可能なwriteTextへ対象テキストを渡す", async () => {
  const writeText = vi.fn(async () => {});
  setClipboard({ writeText });

  await copyTextToClipboard("hello");

  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith("hello");
});

test("copyTextToClipboardはclipboard未定義環境で専用メッセージでrejectする", async () => {
  setClipboard(undefined);

  await expect(copyTextToClipboard("hello")).rejects.toThrow(
    "この環境ではクリップボードを利用できません。",
  );
});

test("copyTextToClipboardはwriteTextの失敗を呼び出し元へ伝播する", async () => {
  const writeText = vi.fn(async () => {
    throw new Error("write failed");
  });
  setClipboard({ writeText });

  await expect(copyTextToClipboard("hello")).rejects.toThrow("write failed");
});
