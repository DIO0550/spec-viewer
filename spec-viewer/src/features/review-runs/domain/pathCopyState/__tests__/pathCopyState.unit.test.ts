import { expect, test } from "vitest";

import { PathCopyState } from "@/features/review-runs/domain/pathCopyState";

test("failedはErrorのメッセージをそのまま表示する", () => {
  expect(PathCopyState.failed(new Error("clipboard unavailable"))).toEqual({
    status: "error",
    message: "clipboard unavailable",
  });
});

test("failedはError以外の失敗を既定メッセージへ置き換える", () => {
  expect(PathCopyState.failed("denied").message).toBe(
    "フォルダパスをコピーできませんでした。",
  );
});
