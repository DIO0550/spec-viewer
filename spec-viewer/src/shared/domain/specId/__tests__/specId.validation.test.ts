import { expect, test } from "vitest";

import contracts from "../../../../../src-tauri/tests/fixtures/identity-value-object-contracts.json";
import { SpecId } from "@/shared/domain/specId";
import * as TestValues from "@/shared/testing/validatedValueObjects";

test.each(contracts.specId.valid)("SpecId.parseは安全な%sを受理する", (raw) => {
  expect(SpecId.parse(raw)).toEqual({ ok: true, value: raw });
});

test.each(
  contracts.specId.invalid,
)("SpecId.parseは不正な%jを拒否する", (raw) => {
  expect(SpecId.parse(raw)).toMatchObject({ ok: false });
  expect(SpecId.fromDto(raw)).toMatchObject({ ok: false });
});

test.each([
  ["root", "root/child", true],
  ["root", "root/child/grandchild", true],
  ["root", "root", false],
  ["root", "rooted/child", false],
  ["root/child", "root", false],
] as const)("SpecId.isStrictAncestorOfは%sと%sのsegment階層を%sと判定する", (candidate, descendant, expected) => {
  expect(
    SpecId.isStrictAncestorOf(
      TestValues.specId(candidate),
      TestValues.specId(descendant),
    ),
  ).toBe(expected);
});
