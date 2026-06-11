import { expect, test } from "vitest";

import { SpecFileNavigation } from "@/features/specs/domain/specFileNavigation";
import type { SpecFile } from "@/features/specs/types/spec";

const files: readonly SpecFile[] = [
  {
    key: "requirements",
    label: "要件",
    fileName: "requirements.md",
    status: "present",
  },
  { key: "design", label: "設計", fileName: "design.md", status: "present" },
  { key: "tasks", label: "タスク", fileName: "tasks.md", status: "present" },
];

test.each([
  ["next", "requirements", "design"],
  ["next", "tasks", "requirements"],
  ["previous", "design", "requirements"],
  ["previous", "requirements", "tasks"],
] as const)("adjacentFileKeyは%s方向へ巡回する(selected=%s)", (direction, selectedFileKey, expected) => {
  expect(
    SpecFileNavigation.adjacentFileKey({
      files,
      selectedFileKey,
      direction,
    }),
  ).toBe(expected);
});

test("adjacentFileKeyは未選択のとき先頭からの移動として扱う", () => {
  expect(
    SpecFileNavigation.adjacentFileKey({
      files,
      selectedFileKey: null,
      direction: "next",
    }),
  ).toBe("design");
});

test("adjacentFileKeyはファイルが無いときnullを返す", () => {
  expect(
    SpecFileNavigation.adjacentFileKey({
      files: [],
      selectedFileKey: null,
      direction: "next",
    }),
  ).toBeNull();
});
