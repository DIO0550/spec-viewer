import { expect, test } from "vitest";

import { RuntimeCodec, decodeRuntimeValue } from "@/shared/lib/runtimeCodec";

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

test("isoDateTime codecはtimezone付きRFC3339 date-timeを受理する", () => {
  expect(
    RuntimeCodec.isoDateTime.decode("2026-07-12T10:20:30.123+09:00"),
  ).toEqual({
    ok: true,
    value: "2026-07-12T10:20:30.123+09:00",
  });
});

test("isoDateTime codecはdate-only文字列を拒否する", () => {
  expect(RuntimeCodec.isoDateTime.decode("2026-07-12")).toEqual({
    ok: false,
    error: {
      path: "$",
      expected: "ISO date-time string",
      actual: "string",
    },
  });
});

test("nonNegativeInteger codecはunsafe integerを拒否する", () => {
  expect(
    RuntimeCodec.nonNegativeInteger.decode(Number.MAX_SAFE_INTEGER + 1),
  ).toEqual({
    ok: false,
    error: {
      path: "$",
      expected: "non-negative integer",
      actual: "number",
    },
  });
});
