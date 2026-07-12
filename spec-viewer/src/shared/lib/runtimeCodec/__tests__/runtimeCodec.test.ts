import { expect, test } from "vitest";

import {
  RuntimeCodec,
  decodeRuntimeValue,
} from "@/shared/lib/runtimeCodec";

test("object codecはmissing fieldをpath付きerrorとして返す", () => {
  const codec = RuntimeCodec.object({
    id: RuntimeCodec.nonEmptyString,
    status: RuntimeCodec.literalUnion(["active", "archived"] as const),
  });

  const result = codec.decode({ id: "review-1" });

  expect(result).toEqual({
    ok: false,
    error: {
      path: "$.status",
      expected: 'one of "active", "archived"',
      actual: "undefined",
    },
  });
});

test("decodeRuntimeValueはcommand固有のstructured errorを送出する", () => {
  expect(() =>
    decodeRuntimeValue(
      "list_specs",
      RuntimeCodec.object({ specs: RuntimeCodec.array(RuntimeCodec.unknown) }),
      { specs: null },
    ),
  ).toThrowError(
    expect.objectContaining({
      name: "IpcResponseDecodeError",
      command: "list_specs",
      code: "invalidResponse",
      path: "$.specs",
      expected: "array",
      actual: "null",
    }),
  );
});
