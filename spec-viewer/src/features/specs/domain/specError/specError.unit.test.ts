import { expect, expectTypeOf, test } from "vitest";

import {
  SpecFeatureError,
  type SpecCommandError,
  type SpecFeatureError as SpecFeatureErrorType,
  type SpecFeatureErrorCode,
} from "@/features/specs/domain/specError";
import { ListSpecsCommandError } from "@/lib/api/tauri/listSpecs";

test("SpecFeatureErrorはfeatureとcommand-local causeを必須にする", () => {
  expectTypeOf<SpecFeatureErrorType>().toEqualTypeOf<
    Readonly<{
      feature: "specs";
      code: SpecFeatureErrorCode;
      message: string;
      cause: SpecCommandError;
    }>
  >();
});

test.each([
  ["invalidSpec", "invalidSpec"],
  ["specTreeScan", "specTreeScan"],
  ["specArchive", "specArchive"],
  ["markdownRead", "markdownRead"],
  ["invalidRequest", "invalidRequest"],
  ["unexpected", "unknown"],
  ["unknown", "unknown"],
] as const)("SpecFeatureError.fromCommandErrorCodeは%sを%sへ写す", (commandCode, featureCode) => {
  expect(SpecFeatureError.fromCommandErrorCode(commandCode)).toBe(featureCode);
});

test("SpecFeatureError.fromCommandErrorはfeature/message/causeを保持する", () => {
  const cause = ListSpecsCommandError.fromUnknown({
    command: "list_specs",
    code: "specTreeScan",
    message: "scan failed",
    raw: { path: "/workspace/spec-reviewer" },
  });

  expect(SpecFeatureError.fromCommandError(cause)).toEqual({
    feature: "specs",
    code: "specTreeScan",
    message: "scan failed",
    cause,
  });
});
