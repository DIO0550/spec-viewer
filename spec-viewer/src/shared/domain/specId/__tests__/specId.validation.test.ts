import { expect, test } from "vitest";

import contracts from "../../../../../src-tauri/tests/fixtures/identity-value-object-contracts.json";
import { SpecId } from "@/shared/domain/specId";

test.each(contracts.specId.valid)("SpecId.parseは安全な%sを受理する", (raw) => {
  expect(SpecId.parse(raw)).toEqual({ ok: true, value: raw });
});

test.each(
  contracts.specId.invalid,
)("SpecId.parseは不正な%jを拒否する", (raw) => {
  expect(SpecId.parse(raw)).toMatchObject({ ok: false });
  expect(SpecId.fromDto(raw)).toMatchObject({ ok: false });
});
