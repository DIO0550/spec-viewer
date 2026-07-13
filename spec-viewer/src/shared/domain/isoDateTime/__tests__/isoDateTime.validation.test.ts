import { expect, test } from "vitest";

import contracts from "../../../../../src-tauri/tests/fixtures/identity-value-object-contracts.json";
import { IsoDateTime } from "@/shared/domain/isoDateTime";

test.each(
  contracts.isoDateTime.valid,
)("IsoDateTime.parseはRFC3339日時%sを受理する", (raw) => {
  expect(IsoDateTime.parse(raw)).toEqual({ ok: true, value: raw });
});

test.each(
  contracts.isoDateTime.invalid,
)("IsoDateTime.parseは不正な%jを拒否する", (raw) => {
  expect(IsoDateTime.parse(raw)).toMatchObject({ ok: false });
  expect(IsoDateTime.fromDto(raw)).toMatchObject({ ok: false });
});
