import * as TestValues from "@/shared/testing/validatedValueObjects";
import { expect, test } from "vitest";

import { IsoDateTime } from "@/shared/domain/isoDateTime";

test.each([
  ["2026-05-05T10:00:00+09:00", "2026-05-05T01:00:00Z", 0],
  ["2026-05-05T01:00:00.0000001Z", "2026-05-05T01:00:00Z", 1],
  ["2026-05-05T01:00:00.0000001Z", "2026-05-05T01:00:00.0000002Z", -1],
  ["2026-05-05T01:00:01Z", "2026-05-05T01:00:00.999999999Z", 1],
] as const)("IsoDateTime.compareはoffsetと任意精度の小数秒を含むinstantを比較する", (left, right, expected) => {
  expect(
    IsoDateTime.compare(
      TestValues.isoDateTime(left),
      TestValues.isoDateTime(right),
    ),
  ).toBe(expected);
});
