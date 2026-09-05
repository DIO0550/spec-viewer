import { expect, test } from "vitest";

import { getFileChangePresentation } from "@/features/diff/lib/fileChangePresentation";

test.each([
  ["added", "A", "追加"],
  ["modified", "M", "変更"],
  ["deleted", "D", "削除"],
  ["renamed", "R", "名前変更"],
  ["copied", "C", "コピー"],
  ["typeChanged", "T", "種別変更"],
  ["untracked", "U", "未追跡"],
  [null, "—", "変更なし"],
] as const)("%sのtokenとlabelを返す", (change, token, label) => {
  expect(getFileChangePresentation(change)).toEqual({ token, label });
});
