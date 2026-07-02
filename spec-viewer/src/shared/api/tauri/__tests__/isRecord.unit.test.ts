import { expect, test } from "vitest";

import { isRecord } from "@/shared/api/tauri/isRecord";

test("isRecordは配列をrecordとして扱わない", () => {
  expect(isRecord([])).toBe(false);
});

test("isRecordは非null objectをrecordとして扱う", () => {
  expect(isRecord({ code: "unknown" })).toBe(true);
});
