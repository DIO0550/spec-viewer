import { expect, test } from "vitest";

import type { SpecFile } from "@/features/specs/domain/specFile";
import { SpecFileCollection } from "@/features/specs/domain/specFileCollection";

const files: readonly SpecFile[] = [
  {
    key: "hearing",
    label: "Hearing",
    fileName: "hearing.md",
    status: "present",
  },
  {
    key: "impl",
    label: "Implementation Plan",
    fileName: "implementation-plan.md",
    status: "present",
  },
  {
    key: "tasks",
    label: "Tasks",
    fileName: "tasks.md",
    status: "present",
  },
];

test("SpecFileCollection.createはbackendが決めたlogical tab順を保持する", () => {
  expect(SpecFileCollection.create(files).map((file) => file.key)).toEqual([
    "hearing",
    "impl",
    "tasks",
  ]);
});

test.each([
  ["impl", "next", "tasks"],
  ["impl", "previous", "hearing"],
  ["tasks", "next", "hearing"],
  ["hearing", "previous", "tasks"],
  [null, "next", "impl"],
  [null, "previous", "tasks"],
] as const)("SpecFileCollection.adjacentKeyはcurrent=%s direction=%sの隣接keyを返す", (currentKey, direction, expected) => {
  expect(SpecFileCollection.adjacentKey(files, currentKey, direction)).toBe(
    expected,
  );
});

test("SpecFileCollection.adjacentKeyは空collectionならnullを返す", () => {
  expect(SpecFileCollection.adjacentKey([], "impl", "next")).toBeNull();
});
