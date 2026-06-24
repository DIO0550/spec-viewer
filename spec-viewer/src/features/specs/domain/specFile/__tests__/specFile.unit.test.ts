import { expect, test } from "vitest";

import { SpecFile } from "@/features/specs/domain/specFile";
import type { SpecFile as SpecFileType } from "@/features/specs/domain/specFile";

const files: readonly SpecFileType[] = [
  {
    key: "impl",
    label: "Implementation Plan",
    fileName: "implementation-plan.md",
    status: "present",
    format: "markdown",
    configSource: "workspaceConfig",
  },
  {
    key: "tasks",
    label: "Tasks",
    fileName: "tasks.md",
    status: "missing",
    format: "html",
    configSource: "specOverride",
  },
];

test("SpecFile.findByKeyは一致するfileを返す", () => {
  expect(SpecFile.findByKey(files, "impl")).toBe(files[0]);
});

test("SpecFile.findByKeyはkeyがnullならnullを返す", () => {
  expect(SpecFile.findByKey(files, null)).toBeNull();
});

test("SpecFile.findByKeyは存在しないkeyならnullを返す", () => {
  expect(SpecFile.findByKey(files, "hearing")).toBeNull();
});

test("SpecFile.firstとfirstKeyは先頭fileとkeyを返す", () => {
  expect(SpecFile.first(files)).toBe(files[0]);
  expect(SpecFile.firstKey(files)).toBe("impl");
});

test("SpecFile.firstとfirstKeyは空配列ならnullを返す", () => {
  expect(SpecFile.first([])).toBeNull();
  expect(SpecFile.firstKey([])).toBeNull();
});

test.each([
  ["impl", true],
  ["hearing", false],
  [null, false],
] as const)("SpecFile.hasKeyはkeyの存在有無を返す", (key, expected) => {
  expect(SpecFile.hasKey(files, key)).toBe(expected);
});

test("SpecFile.isPresentとisMissingはstatusを判定する", () => {
  expect(SpecFile.isPresent(files[0])).toBe(true);
  expect(SpecFile.isMissing(files[0])).toBe(false);
  expect(SpecFile.isPresent(files[1])).toBe(false);
  expect(SpecFile.isMissing(files[1])).toBe(true);
});

test("SpecFile.formatOfは未指定時にmarkdownを返す", () => {
  const fileWithoutFormat: SpecFileType = {
    key: "hearing",
    label: "Hearing Notes",
    fileName: "hearing-notes.md",
    status: "present",
  };

  expect(SpecFile.formatOf(fileWithoutFormat)).toBe("markdown");
  expect(SpecFile.formatOf(files[1])).toBe("html");
});
